# Tasks: Workspace File Explorer

Last updated: 2026-02-11

## Phase 1: Backend (Tauri)

- [x] **Task 1.1**: Create `packages/desktop/src-tauri/src/commands/fs.rs`
  - [x] Implement `FileEntry` struct
  - [x] Implement `fs_read_dir` command
  - [x] Filter hidden files and binary files
  - [x] Error handling

- [x] **Task 1.2**: Add file reading command
  - [x] Implement `FileReadResult` struct
  - [x] Implement `fs_read_file` command
  - [x] Add language detection utility
  - [x] Add file size limits
  - [x] Security: path validation

- [x] **Task 1.3**: Register commands in `lib.rs`
  - [x] Add `mod commands::fs;`
  - [x] Register `fs_read_dir` and `fs_read_file` handlers

## Phase 2: Frontend API

- [x] **Task 2.1**: Add types to `packages/app/src/app/types.ts`
  - [x] `FileNode` interface
  - [x] `FileContent` interface
  - [x] `WorkspaceSecondaryTab` type

- [x] **Task 2.2**: Add API functions to `packages/app/src/app/lib/tauri.ts`
  - [x] `fsReadDir()` function
  - [x] `fsReadFile()` function
  - [x] Type definitions

## Phase 3: Components

- [x] **Task 3.1**: Create `FileTree` component
  - [x] `packages/app/src/app/components/file-tree.tsx`
  - [x] Recursive tree rendering
  - [x] Expand/collapse functionality
  - [x] File/directory icons
  - [x] Selection highlighting

- [x] **Task 3.2**: Create `FilePreview` component
  - [x] `packages/app/src/app/components/file-preview.tsx`
  - [ ] Monaco Editor integration (deferred; using `<pre>`)
  - [x] Language detection display
  - [x] Loading state
  - [x] Error states (binary, too large)

- [ ] **Task 3.3**: Add Monaco Editor dependency (deferred)
  - [ ] Install `@monaco-editor/react` or similar
  - [ ] Configure for readonly mode

## Phase 4: Dashboard Integration

- [x] **Task 4.1**: Extend Dashboard state
  - [x] Add `workspaceSecondaryTabById` state
  - [x] Add `expandedFilePathsByWorkspace` state
  - [x] Add `selectedFilePath` state
  - [x] Add `filePreviewContent` state

- [x] **Task 4.2**: Add right-side tab switch (Work / 项目目录)
  - [x] Convert right panel to Tab layout
  - [x] Work Tab keeps existing right-side content
  - [x] Add 项目目录 Tab for file tree
  - [x] Connect tab state

- [x] **Task 4.3**: Integrate FileTree in 项目目录 Tab
  - [x] Render FileTree when 项目目录 Tab selected
  - [x] Pass workspace path
  - [x] Handle file selection

- [x] **Task 4.4**: Integrate FilePreview
  - [x] Show FilePreview in main content area
  - [x] Load file content from 项目目录 selection
  - [x] Handle loading and error states

## Phase 5: Polish

- [x] **Task 5.1**: Styling
  - [x] Match existing design system
  - [x] File tree indentation
  - [x] Hover/active states

- [x] **Task 5.2**: Edge cases
  - [x] Empty directory handling
  - [x] Permission denied handling
  - [x] Network/deleted file handling

## Phase 6: Verification

- [x] **Task 6.1**: Test scenarios (manual)
- [x] Switch Work / 项目目录 tabs in right panel
- [x] Navigate directory tree
- [x] Click file to preview
- [x] Switch back to Work tab
- [x] Switch workspaces

- [x] **Task 6.2**: Code review
  - [x] Review error handling
  - [x] Review performance
  - [x] Review security

---

## Execution Order

```
Phase 1 (Backend)
  ↓
Phase 2 (API)
  ↓
Phase 3 (Components) ← 可以并行
  ↓
Phase 4 (Integration)
  ↓
Phase 5 (Polish)
  ↓
Phase 6 (Verify)
```

**Estimated Time**: 3-4 hours
**Dependencies**: None (self-contained feature)

---

**Status**: Complete (Monaco deferred)
