# Contract: Frontend - Workspace File Explorer

## Requirements

### REQ-1: Tauri API surface

```typescript
// packages/app/src/app/lib/tauri.ts

export type FileEntry = {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modified?: number;
};

export type FileReadResult = {
  content: string;
  size: number;
  language?: string;
};

export async function fsReadDir(path: string, workspaceRoot: string): Promise<FileEntry[]>;
export async function fsReadFile(path: string, workspaceRoot: string): Promise<FileReadResult>;
```

### REQ-2: File tree component

```typescript
// packages/app/src/app/components/file-tree.tsx
export interface FileTreeProps {
  workspacePath: string;
  expandedPaths: string[];
  selectedPath?: string;
  onToggleExpand: (path: string) => void;
  onSelectFile: (path: string) => void;
}
```

- FileTree must call `fsReadDir(path, workspacePath)` for root and nested directories.
- Selecting a file must invoke `onSelectFile(path)`.

### REQ-3: File preview component

```typescript
// packages/app/src/app/components/file-preview.tsx
export interface FilePreviewProps {
  filePath: string;
  content: FileReadResult | null;
  loading: boolean;
  error?: string | null;
  onClose: () => void;
}
```

### REQ-4: Session view integration

- Right sidebar must provide tabs: `Work` and `项目目录`.
- Work tab keeps existing right-side content.
- 项目目录 tab renders FileTree.
- Selecting a file loads preview and renders FilePreview in the main content area.

### REQ-5: Runtime guards

- If not in Tauri runtime or the workspace is remote, 项目目录 shows an explanatory message.
- File preview should surface load errors in the preview UI.

---

**Status**: Complete  
**Domain**: Frontend  
**Parent**: workspace-file-explorer
