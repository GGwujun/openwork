import { mkdir } from "@tauri-apps/plugin-fs";

import { isTauriRuntime, normalizeDirectoryPath } from "../utils";
import { fsReadFile as tauriReadFile, fsWriteFile as tauriWriteFile } from "./tauri";

const normalizePathInput = (value: string) => value.trim().replace(/\\/g, "/");
const shouldSuppressFsError = (message: string) =>
  /file does not exist|plugin not found|not allowed/i.test(message);

const isAbsolutePath = (value: string) =>
  value.startsWith("/") || /^[a-zA-Z]:\//.test(value);

const resolveWorkspacePath = (workspaceRoot: string, path: string) => {
  const normalizedRoot = normalizeDirectoryPath(workspaceRoot);
  if (!normalizedRoot) {
    throw new Error("workspaceRoot is required");
  }

  const normalizedPath = normalizePathInput(path);
  if (!normalizedPath) {
    throw new Error("path is required");
  }

  if (isAbsolutePath(normalizedPath)) {
    return normalizedPath;
  }

  const root = normalizedRoot.replace(/\/+$/g, "");
  const suffix = normalizedPath.replace(/^\/+/, "");
  return `${root}/${suffix}`;
};

/**
 * Read a workspace-scoped file with unified error handling.
 */
export async function fsReadFile(path: string, workspaceRoot: string) {
  const normalizedPath = normalizePathInput(path);
  const normalizedRoot = normalizeDirectoryPath(workspaceRoot);

  try {
    return await tauriReadFile(normalizedPath, normalizedRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!shouldSuppressFsError(message)) {
      console.error("[fs-utils] fsReadFile failed", { path: normalizedPath, workspaceRoot: normalizedRoot, message });
    }
    throw new Error(`Failed to read file: ${message}`);
  }
}

/**
 * Write a workspace-scoped file with unified error handling.
 */
export async function fsWriteFile(path: string, content: string, workspaceRoot: string): Promise<void> {
  const normalizedPath = normalizePathInput(path);
  const normalizedRoot = normalizeDirectoryPath(workspaceRoot);

  try {
    await tauriWriteFile(normalizedPath, content, normalizedRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!shouldSuppressFsError(message)) {
      console.error("[fs-utils] fsWriteFile failed", { path: normalizedPath, workspaceRoot: normalizedRoot, message });
    }
    throw new Error(`Failed to write file: ${message}`);
  }
}

/**
 * Create a workspace-scoped directory (Tauri-only).
 */
export async function fsCreateDir(path: string, workspaceRoot: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("File system operations are only available in Tauri runtime");
  }

  const resolvedPath = resolveWorkspacePath(workspaceRoot, path);

  try {
    await mkdir(resolvedPath, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!shouldSuppressFsError(message)) {
      console.error("[fs-utils] fsCreateDir failed", { path: resolvedPath, message });
      throw new Error(`Failed to create directory: ${message}`);
    }
  }
}

export const fsUtils = {
  fsReadFile,
  fsWriteFile,
  fsCreateDir,
};
