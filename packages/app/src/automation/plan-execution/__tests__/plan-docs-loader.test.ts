import { describe, expect, it } from "vitest";

import { PlanDocsLoader } from "../plan-docs-loader";
import type {
  TaskCenterArtifactStore,
  TaskCenterPlanDocs,
} from "../../../app/lib/task-center-artifacts";

const createStore = (docs?: TaskCenterPlanDocs | null): TaskCenterArtifactStore => ({
  get: async () =>
    docs
      ? {
          version: 1,
          tfsId: 1,
          updatedAt: new Date().toISOString(),
          planDocs: docs,
        }
      : null,
  list: async () => [],
  update: async () => {
    throw new Error("not implemented");
  },
  remove: async () => undefined,
  ready: () => true,
});

describe("plan-docs-loader", () => {
  it("loads plan docs from artifact store", async () => {
    const loader = new PlanDocsLoader({
      workspaceRoot: "workspace",
      getArtifactStore: () =>
        createStore({ intent: "Intent", design: "Design", tasks: "- [ ] Task" }),
    });

    const docs = await loader.loadFromArtifactStore(1);
    expect(docs?.intent).toBe("Intent");
    expect(docs?.tasks).toContain("Task");
  });

  it("returns null when store docs are empty", async () => {
    const loader = new PlanDocsLoader({
      workspaceRoot: "workspace",
      getArtifactStore: () => createStore({ intent: " ", design: "", tasks: "  " }),
    });

    const docs = await loader.loadFromArtifactStore(1);
    expect(docs).toBeNull();
  });

  it("loads plan docs from file system when tauri", async () => {
    let capturedPath = "";
    const loader = new PlanDocsLoader({
      workspaceRoot: "workspace",
      getArtifactStore: () => createStore(null),
      isTauriRuntime: () => true,
      readArtifactFile: async (path: string) => {
        capturedPath = path;
        return JSON.stringify({
          version: 1,
          tfsId: 2,
          updatedAt: new Date().toISOString(),
          planDocs: {
            intent: "Intent",
            design: "Design",
            tasks: "- [ ] Task",
          },
        });
      },
    });

    const docs = await loader.load(2);
    expect(docs?.tasks).toBe("- [ ] Task");
    expect(capturedPath).toContain("openwork/task-center/");
  });
});
