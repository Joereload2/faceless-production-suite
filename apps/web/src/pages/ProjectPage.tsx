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

  return (
    <main className={styles.page}>
      <p>
        <Link to="/">← Proyectos</Link>
      </p>
      <h1>{project.data?.title ?? "Proyecto"}</h1>
      {project.data ? <p>Canal {project.data.channel} · {project.data.bytesUsed} bytes</p> : null}
      <ApprovalPanel />
      <JobForm projectId={projectId} onCreated={() => void jobs.refetch()} />
      <h2>Jobs</h2>
      <JobTable jobs={jobs.data?.jobs ?? []} onChanged={() => void jobs.refetch()} />
    </main>
  );
}
