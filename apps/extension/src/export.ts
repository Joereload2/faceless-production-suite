import type { StudioRow } from "./parseStudio";

export const API_BASE = "http://127.0.0.1:8787";

export async function postOutliers(projectId: string, studioToken: string, rows: StudioRow[]): Promise<Response> {
  return fetch(`${API_BASE}/projects/${projectId}/outliers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studioToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rows }),
  });
}
