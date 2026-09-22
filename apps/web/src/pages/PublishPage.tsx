import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import styles from "../styles/app.module.css";

type Checklist = {
  originalityOnFile: boolean;
  masterApproved: boolean;
  thumbApproved: boolean;
  hashesMatchDisk: boolean;
  syntheticMediaMarked: boolean;
  stockAttributionSaved: boolean;
  piperVoiceLicenseOk: boolean;
  notMadeForKids: boolean;
  titleMatchesCard: boolean;
};

type Card = { title?: string; description?: string; tags?: string[] };

const HUMAN: Array<{ key: keyof Checklist; label: string }> = [
  { key: "syntheticMediaMarked", label: "Marque contenido sintetico en YouTube" },
  { key: "stockAttributionSaved", label: "Attribution de stock guardada" },
  { key: "piperVoiceLicenseOk", label: "Licencia de voz Piper OK" },
  { key: "notMadeForKids", label: "No es contenido para ninos" },
  { key: "titleMatchesCard", label: "El titulo coincide con la ficha" },
];

export function PublishPage() {
  const { id } = useParams();
  const projectId = id ?? "";
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["publish", projectId],
    queryFn: () =>
      api<{ checklist: Checklist; canOpenStudio: boolean }>(`/projects/${projectId}/publish-checklist`),
    enabled: Boolean(projectId),
  });
  const card = useQuery({
    queryKey: ["card", projectId],
    queryFn: () => api<Card>(`/projects/${projectId}/export/youtube-card.json`),
    enabled: Boolean(projectId),
    retry: false,
  });
  const save = useMutation({
    mutationFn: (human: Pick<
      Checklist,
      | "syntheticMediaMarked"
      | "stockAttributionSaved"
      | "piperVoiceLicenseOk"
      | "notMadeForKids"
      | "titleMatchesCard"
    >) =>
      api(`/projects/${projectId}/publish-checklist`, {
        method: "POST",
        body: JSON.stringify(human),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["publish", projectId] }),
  });
  const c = q.data?.checklist;
  const can = Boolean(q.data?.canOpenStudio);

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  return (
    <main className={styles.page}>
      <p>
        <Link to={`/projects/${projectId}`}>← Proyecto</Link>
      </p>
      <h1>Publicar</h1>
      <p>La API no sube nada. Copias la ficha y abres YouTube Studio tu.</p>
      <ul>
        <li>Guion en disco: {c?.originalityOnFile ? "si" : "no"}</li>
        <li>Master aprobado: {c?.masterApproved ? "si" : "no"}</li>
        <li>Thumb aprobado: {c?.thumbApproved ? "si" : "no"}</li>
        <li>Hashes coinciden: {c?.hashesMatchDisk ? "si" : "no"}</li>
      </ul>
      {c
        ? HUMAN.map((h) => (
            <label key={h.key}>
              <input
                type="checkbox"
                checked={Boolean(c[h.key])}
                onChange={(e) => {
                  save.mutate({
                    syntheticMediaMarked: c.syntheticMediaMarked,
                    stockAttributionSaved: c.stockAttributionSaved,
                    piperVoiceLicenseOk: c.piperVoiceLicenseOk,
                    notMadeForKids: c.notMadeForKids,
                    titleMatchesCard: c.titleMatchesCard,
                    [h.key]: e.target.checked,
                  });
                }}
              />{" "}
              {h.label}
            </label>
          ))
        : null}
      <h2>Ficha</h2>
      <p>
        <button type="button" disabled={!card.data?.title} onClick={() => copy(card.data?.title ?? "")}>
          Copiar titulo
        </button>
        <button
          type="button"
          disabled={!card.data?.description}
          onClick={() => copy(card.data?.description ?? "")}
        >
          Copiar descripcion
        </button>
        <button
          type="button"
          disabled={!card.data?.tags?.length}
          onClick={() => copy((card.data?.tags ?? []).join(", "))}
        >
          Copiar tags
        </button>
      </p>
      <p>
        {can ? (
          <a href="https://studio.youtube.com/upload" target="_blank" rel="noreferrer">
            Abrir YouTube Studio
          </a>
        ) : (
          <button type="button" disabled>
            Abrir YouTube Studio
          </button>
        )}
      </p>
    </main>
  );
}
