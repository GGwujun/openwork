/**
 * TFS Configuration Manager
 * Independent configuration system (not dependent on skills)
 * Config location: .opencode/config/tfs.json
 */

import type { TFSConfig } from "../../api/tfs";
import { DEFAULT_SERVER_URL } from "../../api/tfs";

// Config file path (relative to workspace root)
export const TFS_CONFIG_PATH = ".opencode/config/tfs.json";

// Default configuration
export const DEFAULT_TFS_CONFIG: TFSConfig = {
  serverUrl: DEFAULT_SERVER_URL,
  pat: "",
  username: null,
};

/**
 * Read TFS config from file (Tauri desktop only)
 */
export async function readTfsConfigFromFile(
  readFile: (path: string) => Promise<string>
): Promise<TFSConfig | null> {
  try {
    const content = await readFile(TFS_CONFIG_PATH);
    const parsed = JSON.parse(content) as Partial<TFSConfig>;
    
    if (!parsed.pat) {
      return null;
    }
    
    return {
      serverUrl: parsed.serverUrl || DEFAULT_SERVER_URL,
      pat: parsed.pat,
      username: parsed.username || null,
    };
  } catch (error) {
    // File doesn't exist or is invalid
    return null;
  }
}

/**
 * Write TFS config to file (Tauri desktop only)
 */
export async function writeTfsConfigToFile(
  config: TFSConfig,
  writeFile: (path: string, content: string) => Promise<void>,
  mkdir: (path: string) => Promise<void>
): Promise<void> {
  // Ensure directory exists
  try {
    await mkdir(".opencode/config");
  } catch {
    // Directory might already exist
  }
  
  const content = JSON.stringify(
    {
      serverUrl: config.serverUrl || DEFAULT_SERVER_URL,
      pat: config.pat,
      username: config.username,
    },
    null,
    2
  );
  
  await writeFile(TFS_CONFIG_PATH, content);
}

/**
 * Validate TFS config
 */
export function validateTfsConfig(config: Partial<TFSConfig>): config is TFSConfig {
  return !!config.pat && typeof config.pat === "string" && config.pat.length > 0;
}

/**
 * Create a TFS config from partial data
 */
export function createTfsConfig(partial: Partial<TFSConfig>): TFSConfig {
  return {
    serverUrl: partial.serverUrl || DEFAULT_SERVER_URL,
    pat: partial.pat || "",
    username: partial.username || null,
  };
}
