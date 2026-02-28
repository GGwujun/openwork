import { describe, expect, it } from "vitest";

import {
  getArtifactPath,
  getArtifactScope,
  getTrackId,
  getTrackPath,
} from "../track-paths";

describe("track-paths", () => {
  it("builds track id and path", () => {
    expect(getTrackId(123)).toBe("tfs-123");
    expect(getTrackPath(123)).toBe("forge/tracks/tfs-123");
  });

  it("builds artifact path from scope", () => {
    expect(getArtifactPath("ws-abc", 42)).toBe(
      "openwork/task-center/ws-abc/artifacts/tfs-42.json",
    );
  });

  it("normalizes workspace root when building scope", () => {
    expect(getArtifactScope("")).toBe("default");
    expect(getArtifactScope("C:\\Repo")).toBe(getArtifactScope("C:/Repo/"));
  });
});
