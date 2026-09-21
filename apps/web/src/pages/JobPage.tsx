import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import type { Job } from "@faceless/schema";
import { api } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import { POLL_MS } from "../poll";
import styles from "../styles/app.module.css";

function basename(p: string): string {
  return p.split(/[/\\]/).pop() ?? p;
}

export function JobPage() {
  const { id } = useParams();
  const jobId = id ?? "";
  const q = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => api<Job>(`/jobs/${jobId}`),
    enabled: Boolean(jobId),
    refetchInterval: POLL_MS,
  });
  const job = q.data;

  return (
    <main className={styles.page}>
      <p>
        {job ? <Link to={`/projects/${job.projectId}`}>← Proyecto</Link> : <Link to="/">← Proyectos</Link>}
      </p>
      <h1>Job {jobId.slice(0, 8)}</h1>
      {job ? (
        <>
          <p>
            <StatusBadge status={job.status} /> · {job.module}
          </p>
          {job.error ? (
            <p className={styles.warn}>
              {job.error} <code>{job.errorCode}</code>
            </p>
          ) : null}
          <h2>Archivos</h2>
          <ul>
            {(job.output?.files ?? []).map((f) => {
              const name = basename(f.path);
              return (
                <li key={f.path}>
                  <a href={`/api/jobs/${job.id}/files/${name}`}>{name}</a>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </main>
  );
}
