import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";
import { ProjectForm } from "../components/ProjectForm";
import styles from "../styles/app.module.css";

type Project = { id: string; title: string; channel: string };

export function HomePage() {
  const q = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<{ projects: Project[] }>("/projects"),
  });
  const projects = q.data?.projects ?? [];

  return (
    <main className={styles.page}>
      <h1>Proyectos</h1>
      <ProjectForm onCreated={() => void q.refetch()} />
      {q.isError ? <p className={styles.warn}>{(q.error as Error).message}</p> : null}
      {q.isSuccess && projects.length === 0 ? <p>Sin proyectos</p> : null}
      <ul>
        {projects.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`}>{p.title}</Link> ({p.channel})
          </li>
        ))}
      </ul>
    </main>
  );
}
