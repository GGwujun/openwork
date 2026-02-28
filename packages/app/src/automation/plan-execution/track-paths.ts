import { normalizeDirectoryPath } from "../../app/utils";

const checksum = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

export const getTrackId = (workItemId: number | string) => `tfs-${workItemId}`;

export const getTrackPath = (workItemId: number | string) =>
  `forge/tracks/${getTrackId(workItemId)}`;

export const getArtifactScope = (workspaceRoot: string) => {
  const normalized = normalizeDirectoryPath(workspaceRoot);
  if (!normalized) return "default";
  return `ws-${checksum(normalized)}`;
};

export const getArtifactPath = (scope: string, workItemId: number | string) =>
  `openwork/task-center/${scope}/artifacts/${getTrackId(workItemId)}.json`;
