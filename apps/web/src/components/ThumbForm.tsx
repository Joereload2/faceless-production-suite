import { useState } from "react";
import type { Job } from "@faceless/schema";
import { api } from "../api";
import { newIdempotencyKey } from "../idempotency";

export function ThumbForm({ projectId, jobs, onCreated }: { projectId: string; jobs: Job[]; onCreated?: () => void }) {
  const masters = jobs.filter((j) => j.module === "assemble" && j.status === "done");
  const thumbs = jobs.filter((j) => j.module === "thumb" && j.status === "done");
  const [masterJobId, setMasterJobId] = useState(masters[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [overlayText, setOverlayText] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("faceless");
  const [idempotencyKey] = useState(() => newIdempotencyKey());
  const preview = thumbs[0];

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await api(`/projects/${projectId}/jobs`, {
          method: "POST",
          body: JSON.stringify({
            module: "thumb",
            idempotencyKey,
            input: {
              masterJobId,
              title,
              overlayText,
              description,
              tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
            },
          }),
        });
        onCreated?.();
      }}
    >
      <h2>Thumbnail</h2>
      <label>
        masterJobId
        <select value={masterJobId} onChange={(e) => setMasterJobId(e.target.value)}>
          <option value="">(ninguno)</option>
          {masters.map((j) => (
            <option key={j.id} value={j.id}>
              {j.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Titulo
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
      </label>
      <label>
        Overlay
        <input value={overlayText} onChange={(e) => setOverlayText(e.target.value)} maxLength={32} />
      </label>
      <label>
        Descripcion
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label>
        Tags CSV
        <input value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>
      <button type="submit">Crear thumb</button>
      {preview ? (
        <p>
          Preview: <a href={`/api/jobs/${preview.id}/files/thumb.png`}>thumb.png</a>
        </p>
      ) : null}
    </form>
  );
}
