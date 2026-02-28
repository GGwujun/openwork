import { describe, expect, it } from "vitest";

import { PlanDocsValidator } from "../plan-docs-validator";

describe("plan-docs-validator", () => {
  const validator = new PlanDocsValidator();

  it("fails when docs are missing", () => {
    const result = validator.validate(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("未找到计划文档");
    }
  });

  it("fails when tasks are not parseable", () => {
    const result = validator.validate({
      intent: "Intent",
      design: "Design",
      tasks: "Just a paragraph without tasks",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((err) => err.includes("tasks.md"))).toBe(true);
    }
  });

  it("passes for valid plan docs", () => {
    const result = validator.validate({
      intent: "Intent",
      design: "Design",
      tasks: "- [ ] Task one\n- [x] Task two",
    });

    expect(result.ok).toBe(true);
  });
});
