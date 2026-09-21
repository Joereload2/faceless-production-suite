import { useState } from "react";
import type { Job } from "@faceless/schema";
import { api } from "../api";

export function ApprovalPanel({
  projectId,
  jobs,
  onApproved,
}: {
  projectId: string;
  jobs: Job[];
  onApproved?: () => void;
}) {
  const doneScripts = jobs.filter((j) => j.module === "script" && j.status === "done");
  const [jobId, setJobId] = useState(doneScripts[0]?.id ?? "");
  const [originalAnalysis, setOriginalAnalysis] = useState(false);
  const [variesStructure, setVariesStructure] = useState(false);
  const [notTemplate, setNotTemplate] = useState(false);
  const [error, setError] = useState("");
  const ready = Boolean(jobId) && originalAnalysis && variesStructure && notTemplate;

  return (
    <section>
      <h2>Aprobaciones</h2>
      <p>Puerta 1 — guion</p>
      <label>
        Job script
        <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
          <option value="">(ninguno)</option>
          {doneScripts.map((j) => (
            <option key={j.id} value={j.id}>
              {j.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input type="checkbox" checked={originalAnalysis} onChange={(e) => setOriginalAnalysis(e.target.checked)} />
        Analisis original
      </label>
      <label>
        <input type="checkbox" checked={variesStructure} onChange={(e) => setVariesStructure(e.target.checked)} />
        Estructura distinta
      </label>
      <label>
        <input type="checkbox" checked={notTemplate} onChange={(e) => setNotTemplate(e.target.checked)} />
        No es plantilla
      </label>
      <p>
        <button
          type="button"
          disabled={!ready}
          onClick={async () => {
            setError("");
            try {
              await api(`/projects/${projectId}/approvals/script`, {
                method: "POST",
                body: JSON.stringify({
                  jobId,
                  checklist: { originalAnalysis: true, variesStructure: true, notTemplate: true },
                }),
              });
              onApproved?.();
            } catch (err) {
              setError(err instanceof Error ? err.message : "error");
            }
          }}
        >
          Aprobar guion
        </button>
      </p>
      {error ? <p>{error}</p> : null}
    </section>
  );
}
