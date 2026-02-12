import { resolveDashboardTab } from "../dashboard-tabs";

describe("resolveDashboardTab", () => {
  it("accepts task-center", () => {
    expect(resolveDashboardTab("task-center")).toBe("task-center");
  });
});
