import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { postOutliers } from "./export";
import type { StudioRow } from "./parseStudio";

function Popup() {
  const [projectId, setProjectId] = useState("");
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    chrome.storage.local.get(["projectId", "studioToken"], (got) => {
      if (got.projectId) setProjectId(String(got.projectId));
      if (got.studioToken) setToken(String(got.studioToken));
    });
  }, []);

  return (
    <main style={{ width: 280, padding: 12, fontFamily: "sans-serif" }}>
      <h1>Outliers</h1>
      <label>
        projectId
        <input
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            chrome.storage.local.set({ projectId: e.target.value });
          }}
        />
      </label>
      <label>
        Token
        <input
          type="password"
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            chrome.storage.local.set({ studioToken: e.target.value });
          }}
        />
      </label>
      <p>
        <button
          type="button"
          onClick={async () => {
            setMsg("");
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
              setMsg("no tab");
              return;
            }
            chrome.tabs.sendMessage(tab.id, { type: "CAPTURE" }, async (res: { rows?: StudioRow[] }) => {
              const rows = res?.rows ?? [];
              const r = await postOutliers(projectId, token, rows);
              setMsg(r.ok ? `ok ${rows.length}` : `error ${r.status}`);
            });
          }}
        >
          Capturar
        </button>
      </p>
      <p>{msg}</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
