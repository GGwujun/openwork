# Workspace File Explorer Backend Contract

## Purpose
Define the filesystem commands used by the workspace file explorer with security and size limits.

## Requirements

### REQ-1: File entry + read result types

```rust
// packages/desktop/src-tauri/src/commands/fs.rs

#[derive(Debug, Clone, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub entry_type: String, // "file" | "directory"
    pub size: Option<u64>,
    pub modified: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileReadResult {
    pub content: String,
    pub size: u64,
    pub language: Option<String>,
}
```

### REQ-2: Directory read command

```rust
#[tauri::command]
pub async fn fs_read_dir(path: String, workspace_root: String) -> Result<Vec<FileEntry>, String>;
```

- `workspace_root` is required.
- `path` may be absolute or workspace-relative.
- Reject paths outside `workspace_root`.
- Return entries sorted: directories first, then files, name ascending.
- Filter hidden files/dirs and known binary entries.

### REQ-3: File read command

```rust
#[tauri::command]
pub async fn fs_read_file(path: String, workspace_root: String) -> Result<FileReadResult, String>;
```

- `workspace_root` is required.
- `path` may be absolute or workspace-relative.
- Reject paths outside `workspace_root`.
- Enforce size limit (1MB) and binary file rejection.
- Return detected language by extension.

### REQ-4: Security & limits

- Path validation must rely on canonicalized paths.
- Fail if workspace root is missing or not a directory.
