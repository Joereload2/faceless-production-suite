import { useState } from "react";
import { api } from "../api";

export function ProjectForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("demo");
  const [error, setError] = useState("");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          await api("/projects", { method: "POST", body: JSON.stringify({ title, channel }) });
          setTitle("");
          onCreated();
        } catch (err) {
          setError(err instanceof Error ? err.message : "error");
        }
      }}
    >
      <div className="row">
        <label>
          Titulo
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
        </label>
        <label>
          Canal
          <input value={channel} onChange={(e) => setChannel(e.target.value)} required />
        </label>
        <button type="submit">Crear proyecto</button>
      </div>
      {error ? <p className="warn">{error}</p> : null}
    </form>
  );
}
