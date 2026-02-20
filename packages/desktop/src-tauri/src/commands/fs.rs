use serde::Serialize;
use std::path::{Path, PathBuf};

const MAX_PREVIEW_SIZE: u64 = 1024 * 1024; // 1MB
const HIDDEN_PREFIXES: &[&str] = &[".", "node_modules", "target", "dist", "build"];

#[derive(Debug, Clone, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub entry_type: String,
    pub size: Option<u64>,
    pub modified: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileReadResult {
    pub content: String,
    pub size: u64,
    pub language: Option<String>,
}

fn normalize_path(path: &Path) -> Result<PathBuf, String> {
    // Windows 下使用绝对路径规范化
    #[cfg(windows)]
    {
        // 如果已经是绝对路径，就使用它
        if path.is_absolute() {
            return Ok(path.to_path_buf());
        }
    }
    std::fs::canonicalize(path).map_err(|e| format!("Failed to resolve path: {e}"))
}

fn ensure_path_allowed(path: &Path, workspace_root: &Path) -> Result<(), String> {
    if !workspace_root.exists() {
        return Err("Workspace root does not exist".to_string());
    }
    if !workspace_root.is_dir() {
        return Err("Workspace root is not a directory".to_string());
    }

    // 转换 workspace_root 为绝对路径
    let root = if workspace_root.is_absolute() {
        workspace_root.to_path_buf()
    } else {
        std::env::current_dir()
            .map_err(|e| format!("Failed to get current dir: {e}"))?
            .join(workspace_root)
    };
    
    // 转换 target 为绝对路径
    let target = if path.is_absolute() {
        path.to_path_buf()
    } else {
        root.join(path)
    };
    
    // 检查 target 是否以 root 开头（使用规范化后的字符串比较）
    let root_str = root.to_string_lossy().to_lowercase();
    let target_str = target.to_string_lossy().to_lowercase();
    
    if !target_str.starts_with(&root_str) {
        return Err(format!("Path '{}' is outside workspace '{}'", target.display(), root.display()));
    }

    Ok(())
}

/// 读取目录内容
#[tauri::command]
pub async fn fs_read_dir(path: String, workspace_root: String) -> Result<Vec<FileEntry>, String> {
    let workspace_root = workspace_root.trim();
    if workspace_root.is_empty() {
        return Err("workspace_root is required".to_string());
    }

    let path_obj = Path::new(&path);
    let resolved_path = if path_obj.is_absolute() {
        path_obj.to_path_buf()
    } else {
        Path::new(workspace_root).join(path_obj)
    };

    ensure_path_allowed(&resolved_path, Path::new(workspace_root))?;
    
    if !resolved_path.exists() {
        return Err(format!("Path does not exist: {}", resolved_path.display()));
    }
    
    if !resolved_path.is_dir() {
        return Err(format!("Path is not a directory: {}", resolved_path.display()));
    }
    
    let mut entries = Vec::new();
    
    match std::fs::read_dir(&resolved_path) {
        Ok(dir_entries) => {
            for entry_result in dir_entries {
                match entry_result {
                    Ok(entry) => {
                        let name = entry.file_name().to_string_lossy().to_string();
                        
                        // 跳过隐藏文件和目录
                        if is_hidden(&name) {
                            continue;
                        }
                        
                        let path_str = entry.path().to_string_lossy().to_string();
                        let metadata = entry.metadata().ok();
                        
                        let entry_type = if entry.path().is_dir() {
                            "directory".to_string()
                        } else {
                            "file".to_string()
                        };
                        
                        let size = metadata.as_ref().map(|m| m.len());
                        let modified = metadata
                            .as_ref()
                            .and_then(|m| m.modified().ok())
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| d.as_secs());
                        
                        entries.push(FileEntry {
                            name,
                            path: path_str,
                            entry_type,
                            size,
                            modified,
                        });
                    }
                    Err(e) => {
                        eprintln!("Error reading entry: {}", e);
                        continue;
                    }
                }
            }
        }
        Err(e) => {
            return Err(format!("Failed to read directory: {}", e));
        }
    }
    
    // 排序：目录在前，文件在后，按名称排序
    entries.sort_by(|a, b| {
        match (a.entry_type.as_str(), b.entry_type.as_str()) {
            ("directory", "file") => std::cmp::Ordering::Less,
            ("file", "directory") => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    Ok(entries)
}

/// 读取文件内容
#[tauri::command]
pub async fn fs_read_file(path: String, workspace_root: String) -> Result<FileReadResult, String> {
    let workspace_root = workspace_root.trim();
    if workspace_root.is_empty() {
        return Err("workspace_root is required".to_string());
    }

    let path_obj = Path::new(&path);
    let resolved_path = if path_obj.is_absolute() {
        path_obj.to_path_buf()
    } else {
        Path::new(workspace_root).join(path_obj)
    };

    ensure_path_allowed(&resolved_path, Path::new(workspace_root))?;
    
    if !resolved_path.exists() {
        return Err(format!("File does not exist: {}", resolved_path.display()));
    }
    
    if !resolved_path.is_file() {
        return Err(format!("Path is not a file: {}", resolved_path.display()));
    }
    
    // 检查文件大小
    let metadata = match std::fs::metadata(&resolved_path) {
        Ok(m) => m,
        Err(e) => return Err(format!("Failed to read file metadata: {}", e)),
    };
    
    let size = metadata.len();
    
    if size > MAX_PREVIEW_SIZE {
        return Err(format!(
            "File too large: {} bytes (max: {} bytes)",
            size, MAX_PREVIEW_SIZE
        ));
    }
    
    // 检测是否为二进制文件
    if is_binary_file(&resolved_path) {
        return Err("Binary files cannot be previewed".to_string());
    }
    
    // 读取文件内容
    let content = match std::fs::read_to_string(&resolved_path) {
        Ok(c) => c,
        Err(e) => {
            if e.kind() == std::io::ErrorKind::InvalidData {
                return Err("File appears to be binary or has invalid encoding".to_string());
            }
            return Err(format!("Failed to read file: {}", e));
        }
    };
    
    // 检测语言
    let language = detect_language(&resolved_path);
    
    Ok(FileReadResult {
        content,
        size,
        language,
    })
}

/// 写入文件内容
#[tauri::command]
pub async fn fs_write_file(path: String, content: String, workspace_root: String) -> Result<(), String> {
    let workspace_root = workspace_root.trim();
    if workspace_root.is_empty() {
        return Err("workspace_root is required".to_string());
    }

    // 检查 workspace_root 是否存在
    let workspace_path = Path::new(workspace_root);
    if !workspace_path.exists() {
        return Err(format!("Workspace root does not exist: {}", workspace_root));
    }
    
    if !workspace_path.is_dir() {
        return Err(format!("Workspace root is not a directory: {}", workspace_root));
    }

    let path_obj = Path::new(&path);
    let resolved_path = if path_obj.is_absolute() {
        path_obj.to_path_buf()
    } else {
        workspace_path.join(path_obj)
    };

    ensure_path_allowed(&resolved_path, workspace_path)?;
    
    // 确保父目录存在（递归创建）
    if let Some(parent) = resolved_path.parent() {
        if !parent.exists() {
            match std::fs::create_dir_all(parent) {
                Ok(_) => {},
                Err(e) => {
                    // 如果创建失败，可能是目录已存在（竞争条件）
                    if !parent.exists() {
                        return Err(format!("Failed to create parent directory '{}': {}", parent.display(), e));
                    }
                }
            }
        }
    }
    
    // 写入文件
    std::fs::write(&resolved_path, content)
        .map_err(|e| format!("Failed to write file '{}': {}", resolved_path.display(), e))?;
    
    Ok(())
}

/// 检查是否为隐藏文件/目录
fn is_hidden(name: &str) -> bool {
    HIDDEN_PREFIXES.iter().any(|prefix| name.starts_with(prefix))
}

/// 检测是否为二进制文件
fn is_binary_file(path: &Path) -> bool {
    const BINARY_EXTENSIONS: &[&str] = &[
        "exe", "dll", "so", "dylib", "bin",
        "png", "jpg", "jpeg", "gif", "bmp", "ico", "svg", "webp",
        "mp3", "mp4", "wav", "avi", "mov", "mkv",
        "zip", "tar", "gz", "rar", "7z", "bz2", "xz",
        "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
        "ttf", "otf", "woff", "woff2", "eot",
    ];
    
    if let Some(ext) = path.extension() {
        let ext_str = ext.to_string_lossy().to_lowercase();
        return BINARY_EXTENSIONS.contains(&ext_str.as_str());
    }
    
    false
}

/// 根据文件扩展名检测语言
fn detect_language(path: &Path) -> Option<String> {
    let ext = path.extension()?.to_string_lossy().to_lowercase();
    
    let lang = match ext.as_str() {
        "ts" | "tsx" => "typescript",
        "js" | "jsx" => "javascript",
        "json" => "json",
        "html" | "htm" => "html",
        "css" => "css",
        "scss" | "sass" => "scss",
        "less" => "less",
        "md" | "markdown" => "markdown",
        "py" => "python",
        "rs" => "rust",
        "go" => "go",
        "java" => "java",
        "c" => "c",
        "cpp" | "cc" | "cxx" => "cpp",
        "h" | "hpp" => "cpp",
        "cs" => "csharp",
        "php" => "php",
        "rb" => "ruby",
        "swift" => "swift",
        "kt" => "kotlin",
        "scala" => "scala",
        "r" => "r",
        "sql" => "sql",
        "sh" | "bash" => "shell",
        "ps1" => "powershell",
        "yaml" | "yml" => "yaml",
        "toml" => "toml",
        "xml" => "xml",
        "dockerfile" => "dockerfile",
        "vue" => "vue",
        "svelte" => "svelte",
        _ => return None,
    };
    
    Some(lang.to_string())
}
