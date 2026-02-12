import type { DashboardTab } from "../types";

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

const dashboardTabSet = new Set<DashboardTab>(DASHBOARD_TABS);

export const resolveDashboardTab = (value?: string | null): DashboardTab => {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (dashboardTabSet.has(normalized as DashboardTab)) {
    return normalized as DashboardTab;
  }
  return "scheduled";
};
