import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("AnalysisStatusBadge", () => {
  it("uses contract badge classes for analysis status", () => {
    const source = readFileSync(new URL("../AnalysisStatusBadge.tsx", import.meta.url), "utf8");

    expect(source).toContain("badge-blue");
    expect(source).toContain("badge-pulse");
  });

  it("uses contract badge classes for completion and sync", () => {
    const source = readFileSync(new URL("../AnalysisStatusBadge.tsx", import.meta.url), "utf8");

    expect(source).toContain("badge-green");
    expect(source).toContain("badge-purple");
  });

  it("uses contract badge classes for failure", () => {
    const source = readFileSync(new URL("../AnalysisStatusBadge.tsx", import.meta.url), "utf8");

    expect(source).toContain("badge-red");
  });
});
