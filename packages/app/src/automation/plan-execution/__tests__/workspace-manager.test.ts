import { describe, expect, it, vi } from "vitest";

import { getOrCreateWorkspace } from "../workspace-manager";
import type { WorkspaceInfo } from "../../../app/lib/tauri";
import type { RepositoryMatch } from "../../../types/requirement-analyzer";

const createWorkspace = (overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo => ({
  id: "ws-1",
  name: "Workspace",
  path: "/repo",
  preset: "starter",
  workspaceType: "local",
  ...overrides,
});

const createRepo = (path: string, isPrimary = true): RepositoryMatch => ({
  id: "repo-1",
  name: "Repo",
  path,
  description: "",
  reason: "",
  confidence: 1,
  isPrimary,
});

describe("workspace-manager", () => {
  it("returns mapped workspace when valid", async () => {
    const activateWorkspace = vi.fn(async () => true);
    const result = await getOrCreateWorkspace(1, [createRepo("/repo")], {
      getWorkspaces: () => [createWorkspace({ id: "ws-1", path: "/repo" })],
      createWorkspaceForRepo: vi.fn(async () => null),
      activateWorkspace,
      getActiveWorkspaceRoot: () => "/repo",
      getWorkspaceMap: () => ({
        1: { workspaceId: "ws-1", workspaceRoot: "/repo", updatedAt: Date.now() },
      }),
      setWorkspaceMapEntry: vi.fn(),
    });

    expect(result.success).toBe(true);
    expect(result.workspace?.workspaceId).toBe("ws-1");
    expect(activateWorkspace).not.toHaveBeenCalled();
  });

  it("activates workspace when mapped but inactive", async () => {
    const activateWorkspace = vi.fn(async () => true);
    const result = await getOrCreateWorkspace(1, [createRepo("/repo")], {
      getWorkspaces: () => [createWorkspace({ id: "ws-1", path: "/repo" })],
      createWorkspaceForRepo: vi.fn(async () => null),
      activateWorkspace,
      getActiveWorkspaceRoot: () => "",
      getWorkspaceMap: () => ({
        1: { workspaceId: "ws-1", workspaceRoot: "/repo", updatedAt: Date.now() },
      }),
      setWorkspaceMapEntry: vi.fn(),
    });

    expect(result.success).toBe(true);
    expect(activateWorkspace).toHaveBeenCalledWith("ws-1");
  });

  it("auto-creates workspace when no match", async () => {
    const createWorkspaceForRepo = vi.fn(async () => createWorkspace({ id: "ws-2", path: "/new" }));
    const activateWorkspace = vi.fn(async () => true);
    const setWorkspaceMapEntry = vi.fn();

    const result = await getOrCreateWorkspace(2, [createRepo("/new")], {
      getWorkspaces: () => [],
      createWorkspaceForRepo,
      activateWorkspace,
      getActiveWorkspaceRoot: () => "",
      getWorkspaceMap: () => ({}),
      setWorkspaceMapEntry,
    });

    expect(result.success).toBe(true);
    expect(createWorkspaceForRepo).toHaveBeenCalled();
    expect(setWorkspaceMapEntry).toHaveBeenCalled();
  });

  it("reports ambiguous matches", async () => {
    const repo = createRepo("https://example.com/repo.git");
    const result = await getOrCreateWorkspace(3, [repo], {
      getWorkspaces: () => [
        createWorkspace({ id: "ws-a", path: "/a" }),
        createWorkspace({ id: "ws-b", path: "/b" }),
      ],
      createWorkspaceForRepo: vi.fn(async () => null),
      activateWorkspace: vi.fn(async () => true),
      getActiveWorkspaceRoot: () => "",
      getWorkspaceMap: () => ({}),
      setWorkspaceMapEntry: vi.fn(),
      readWorkspaceOriginUrl: async () => "https://example.com/repo.git",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("匹配到多个工作区");
  });

  it("fails when repo list is empty", async () => {
    const result = await getOrCreateWorkspace(4, [], {
      getWorkspaces: () => [],
      createWorkspaceForRepo: vi.fn(async () => null),
      activateWorkspace: vi.fn(async () => true),
      getActiveWorkspaceRoot: () => "",
      getWorkspaceMap: () => ({}),
      setWorkspaceMapEntry: vi.fn(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("未识别到目标仓库");
  });
});
