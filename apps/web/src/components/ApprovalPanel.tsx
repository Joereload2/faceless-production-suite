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
  const doneMasters = jobs.filter((j) => j.module === "assemble" && j.status === "done");
  const doneThumbs = jobs.filter((j) => j.module === "thumb" && j.status === "done");
  const [jobId, setJobId] = useState(doneScripts[0]?.id ?? "");
  const [masterId, setMasterId] = useState(doneMasters[0]?.id ?? "");
  const [thumbId, setThumbId] = useState(doneThumbs[0]?.id ?? "");
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
      <p>Puerta 2 — master + thumb</p>
      <label>
        Job assemble
        <select value={masterId} onChange={(e) => setMasterId(e.target.value)}>
          <option value="">(ninguno)</option>
          {doneMasters.map((j) => (
            <option key={j.id} value={j.id}>
              {j.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      <p>
        <button
          type="button"
          disabled={!masterId}
          onClick={async () => {
            setError("");
            try {
              await api(`/projects/${projectId}/approvals/master`, {
                method: "POST",
                body: JSON.stringify({ jobId: masterId }),
              });
              onApproved?.();
            } catch (err) {
              setError(err instanceof Error ? err.message : "error");
            }
          }}
        >
          Aprobar master
        </button>
      </p>
      <label>
        Job thumb
        <select value={thumbId} onChange={(e) => setThumbId(e.target.value)}>
          <option value="">(ninguno)</option>
          {doneThumbs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      <p>
        <button
          type="button"
          disabled={!thumbId}
          onClick={async () => {
            setError("");
            try {
              await api(`/projects/${projectId}/approvals/thumb`, {
                method: "POST",
                body: JSON.stringify({ jobId: thumbId }),
              });
              onApproved?.();
            } catch (err) {
              setError(err instanceof Error ? err.message : "error");
            }
          }}
        >
          Aprobar thumb
        </button>
      </p>
      {error ? <p>{error}</p> : null}
    </section>
  );
}
