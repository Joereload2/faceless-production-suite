import { useRef, useState } from "react";
import type { Module } from "@faceless/schema";
import { CreateJobBodyZ, INPUT_ZOD } from "@faceless/schema/inputs";
import { api } from "../api";
import { newIdempotencyKey } from "../idempotency";

const MODULES: Module[] = [
  "script",
  "tts",
  "captions",
  "assemble",
  "stock",
  "seo",
  "thumb",
  "image",
  "video",
];

export function JobForm({ projectId, onCreated }: { projectId: string; onCreated?: () => void }) {
  const [module, setModule] = useState<Module>("tts");
  const [inputText, setInputText] = useState('{"text":"Hola desde la biblioteca."}');
  const [idempotencyKey] = useState(() => newIdempotencyKey());
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (inFlight.current) return;
        inFlight.current = true;
        setError("");
        try {
          let input: unknown;
          try {
            input = JSON.parse(inputText);
          } catch {
            throw new Error("JSON de input invalido");
          }
          const parsedInput = INPUT_ZOD[module].safeParse(input);
          if (!parsedInput.success) {
            throw new Error(parsedInput.error.issues[0]?.message ?? "validation");
          }
          const body = CreateJobBodyZ.parse({
            module,
            idempotencyKey,
            input: parsedInput.data,
          });
          await api(`/projects/${projectId}/jobs`, { method: "POST", body: JSON.stringify(body) });
          onCreated?.();
        } catch (err) {
          setError(err instanceof Error ? err.message : "error");
        } finally {
          inFlight.current = false;
        }
      }}
    >
      <h2>Nuevo job</h2>
      <label>
        Modulo
        <select value={module} onChange={(e) => setModule(e.target.value as Module)}>
          {MODULES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label>
        Input JSON
        <textarea rows={6} value={inputText} onChange={(e) => setInputText(e.target.value)} />
      </label>
      <p>
        Clave de idempotencia: <code>{idempotencyKey}</code>
      </p>
      <button type="submit">Crear job</button>
      {error ? <p className="warn">{error}</p> : null}
    </form>
  );
}
