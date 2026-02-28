import { describe, expect, it } from "vitest";

import { ExecutionPromptBuilder } from "../execution-prompt-builder";
import type { ExecutionContext } from "../types";

const baseContext: ExecutionContext = {
  tfsId: 123,
  title: "Test Work Item",
  workspaceRoot: "/workspace/root",
  trackPath: "forge/tracks/tfs-123",
  planDocs: {
    intent: "# Intent\nIntent content",
    design: "# Design\nDesign content",
    tasks: "# Tasks\n- [ ] Task A",
  },
  selectedRepos: [
    {
      id: "repo-1",
      name: "Repo One",
      path: "/workspace/root",
      description: "",
      reason: "",
      confidence: 1,
      isPrimary: true,
    },
  ],
};

describe("ExecutionPromptBuilder", () => {
  it("builds a prompt containing workspace and track info", () => {
    const builder = new ExecutionPromptBuilder(baseContext);
    const prompt = builder.build();

    expect(prompt).toContain("/workspace/root");
    expect(prompt).toContain("forge/tracks/tfs-123");
    expect(prompt).toContain("Test Work Item");
    expect(prompt).toContain("forge-execute");
  });

  it("renders plan docs sections", () => {
    const builder = new ExecutionPromptBuilder(baseContext);
    const prompt = builder.build();

    expect(prompt).toContain("Intent content");
    expect(prompt).toContain("Design content");
    expect(prompt).toContain("Task A");
  });

  it("respects custom execution options", () => {
    const builder = new ExecutionPromptBuilder({
      ...baseContext,
      options: {
        allowQuestions: false,
        requireArchive: true,
        requireVerification: true,
        includeForgeSkills: true,
      },
    });

    const prompt = builder.build({ allowQuestions: false });

    expect(prompt).toContain("允许提问: 否");
    expect(prompt).toContain("需要验证: 是");
    expect(prompt).toContain("需要归档: 是");
  });

  it("includes progress reporting guidance", () => {
    const builder = new ExecutionPromptBuilder(baseContext);
    const prompt = builder.build();

    expect(prompt).toContain("[PROGRESS]");
    expect(prompt).toContain("进度报告");
  });

  it("includes question feedback guidance", () => {
    const builder = new ExecutionPromptBuilder(baseContext);
    const prompt = builder.build();

    expect(prompt).toContain("[QUESTION]");
    expect(prompt).toContain("等待用户回复");
  });

  it("can omit forge skill guidance", () => {
    const builder = new ExecutionPromptBuilder({
      ...baseContext,
      options: { includeForgeSkills: false },
    });
    const prompt = builder.build();

    expect(prompt).not.toContain("forge-execute");
  });
});
