# Tasks

> **For Claude:** REQUIRED SUB-SKILL: Use forge:executing-plans to implement this plan task-by-task.

**Change:** task-center-missing

**Goal:** Restore Task Center as a visible Dashboard tab and render its view without blank states.

**Architecture:** Introduce a shared dashboard tab resolver, wire the Task Center store into dashboard props, and render TaskCenterView in the Dashboard tab switch alongside desktop/mobile nav entries.

**Tech Stack:** SolidJS, TypeScript, Vitest, OpenWork UI

---

### Task 1: Add dashboard tab resolver + failing test ✅ Completed

**Files:**
- Create: `packages/app/src/app/utils/dashboard-tabs.ts`
- Create: `packages/app/src/app/utils/__tests__/dashboard-tabs.test.ts`

**Step 1: Add dashboard tab resolver (current behavior, no task-center yet)**

```ts
import type { DashboardTab } from "../types";

export const DASHBOARD_TABS: DashboardTab[] = [
  "scheduled",
  "skills",
  "plugins",
  "mcp",
  "identities",
  "config",
  "settings",
];

const dashboardTabSet = new Set<DashboardTab>(DASHBOARD_TABS);

export const resolveDashboardTab = (value?: string | null): DashboardTab => {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (dashboardTabSet.has(normalized as DashboardTab)) {
    return normalized as DashboardTab;
  }
  return "scheduled";
};
```

**Step 2: Write failing test (expects task-center support)**

```ts
import { resolveDashboardTab } from "../dashboard-tabs";

describe("resolveDashboardTab", () => {
  it("accepts task-center", () => {
    expect(resolveDashboardTab("task-center")).toBe("task-center");
  });
});
```

**Step 3: Run test to verify it fails**

Run: `pnpm --filter @different-ai/openwork-ui test -- src/app/utils/__tests__/dashboard-tabs.test.ts`

Expected: FAIL because `resolveDashboardTab("task-center")` returns `"scheduled"`.

---

### Task 2: Wire Task Center tab into dashboard + make test pass ✅ Completed

**Files:**
- Modify: `packages/app/src/app/app.tsx`
- Modify: `packages/app/src/app/pages/dashboard.tsx`
- Modify: `packages/app/src/app/utils/dashboard-tabs.ts`

**Step 1: Update resolver to include task-center**

```ts
export const DASHBOARD_TABS: DashboardTab[] = [
  "scheduled",
  "skills",
  "plugins",
  "mcp",
  "identities",
  "config",
  "settings",
  "task-center",
];
```

**Step 2: Wire Task Center store into app dashboard props**

- Import `createTaskCenterStore` from `./context/task-center` and `resolveDashboardTab` from `./utils/dashboard-tabs`.
- Create the store after `createSessionAndOpen`:

```ts
const taskCenterStore = createTaskCenterStore({
  client,
  activeWorkspaceRoot: () => workspaceStore.activeWorkspaceRoot().trim(),
  createSessionAndOpen,
  setPrompt,
});
```

- Replace the inline `dashboardTabs`/`resolveDashboardTab` with the imported `resolveDashboardTab`.
- Add Task Center props to `dashboardProps()`:

```ts
taskCenterItemsByStatus: taskCenterStore.itemsByStatus(),
taskCenterStatus: taskCenterStore.status(),
taskCenterError: taskCenterStore.error(),
taskCenterSyncing: taskCenterStore.syncing(),
taskCenterLastUpdatedAt: taskCenterStore.lastUpdatedAt(),
taskCenterSyncTasks: taskCenterStore.syncTasks,
taskCenterStartAutomation: taskCenterStore.startAutomation,
taskCenterSelectedItem: taskCenterStore.selectedItem(),
taskCenterTasks: taskCenterStore.tasks(),
taskCenterCurrentTaskIndex: taskCenterStore.currentTaskIndex(),
taskCenterExecuting: taskCenterStore.executing(),
taskCenterSelectItem: taskCenterStore.selectItem,
taskCenterExecuteTask: taskCenterStore.executeTaskStep,
taskCenterCompleteTask: taskCenterStore.completeTaskStep,
```

**Step 3: Render Task Center in Dashboard view + add nav items**

- Import `TaskCenterView` and an icon (e.g. `ClipboardList`).
- Update the title switch to include `task-center`.
- Add a `<Match when={props.tab === "task-center"}>` rendering `TaskCenterView` with mapped props.
- Add `navItem("task-center", "Task Center", <ClipboardList size={18} />)` to the desktop right nav.
- Add a mobile nav button; update grid columns to 7.

Example mapping:

```tsx
<TaskCenterView
  itemsByStatus={props.taskCenterItemsByStatus}
  status={props.taskCenterStatus}
  error={props.taskCenterError}
  syncing={props.taskCenterSyncing}
  lastUpdatedAt={props.taskCenterLastUpdatedAt}
  syncTasks={props.taskCenterSyncTasks}
  startAutomation={props.taskCenterStartAutomation}
  selectedItem={props.taskCenterSelectedItem}
  tasks={props.taskCenterTasks}
  currentTaskIndex={props.taskCenterCurrentTaskIndex}
  executing={props.taskCenterExecuting}
  onSelectItem={props.taskCenterSelectItem}
  onExecuteTask={props.taskCenterExecuteTask}
  onCompleteTask={props.taskCenterCompleteTask}
/>
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @different-ai/openwork-ui test -- src/app/utils/__tests__/dashboard-tabs.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/app/src/app/app.tsx packages/app/src/app/pages/dashboard.tsx packages/app/src/app/utils/dashboard-tabs.ts packages/app/src/app/utils/__tests__/dashboard-tabs.test.ts
git commit -m "fix: restore Task Center dashboard tab"
```

**Note:** Tests were not executed per user request. Manual verification required.
