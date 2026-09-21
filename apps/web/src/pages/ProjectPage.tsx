import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import type { Job } from "@faceless/schema";
import { api } from "../api";
import { ApprovalPanel } from "../components/ApprovalPanel";
import { JobForm } from "../components/JobForm";
import { JobTable } from "../components/JobTable";
import { POLL_MS } from "../poll";
import styles from "../styles/app.module.css";

type Project = { id: string; title: string; channel: string; bytesUsed: number };
type Outlier = { videoId: string; title: string; views: number | null; ratio: number | null };

export function ProjectPage() {
  const { id } = useParams();
  const projectId = id ?? "";
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api<Project>(`/projects/${projectId}`),
    enabled: Boolean(projectId),
  });
  const jobs = useQuery({
    queryKey: ["jobs", projectId],
    queryFn: () => api<{ jobs: Job[] }>(`/projects/${projectId}/jobs`),
    enabled: Boolean(projectId),
    refetchInterval: POLL_MS,
  });
  const outliers = useQuery({
    queryKey: ["outliers", projectId],
    queryFn: () => api<{ rows: Outlier[] }>(`/projects/${projectId}/outliers`),
    enabled: Boolean(projectId),
  });

  return (
    <main className={styles.page}>
      <p>
        <Link to="/">← Proyectos</Link>
      </p>
      <h1>{project.data?.title ?? "Proyecto"}</h1>
      {project.data ? <p>Canal {project.data.channel} · {project.data.bytesUsed} bytes</p> : null}
      <ApprovalPanel
        projectId={projectId}
        jobs={jobs.data?.jobs ?? []}
        onApproved={() => void project.refetch()}
      />
      <JobForm projectId={projectId} onCreated={() => void jobs.refetch()} />
      <h2>Jobs</h2>
      <JobTable jobs={jobs.data?.jobs ?? []} onChanged={() => void jobs.refetch()} />
      <h2>Outliers</h2>
      <table>
        <thead>
          <tr>
            <th>Video</th>
            <th>Titulo</th>
            <th>Views</th>
            <th>Ratio</th>
          </tr>
        </thead>
        <tbody>
          {(outliers.data?.rows ?? []).map((r) => (
            <tr key={r.videoId}>
              <td>{r.videoId}</td>
              <td>{r.title}</td>
              <td>{r.views ?? "—"}</td>
              <td>{r.ratio ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
