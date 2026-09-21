import { Link } from "react-router-dom";
import type { Job } from "@faceless/schema";
import { StatusBadge } from "./StatusBadge";
import { api } from "../api";

export function JobTable({ jobs, onChanged }: { jobs: Job[]; onChanged?: () => void }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Id</th>
          <th>Modulo</th>
          <th>Estado</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((j) => (
          <tr key={j.id}>
            <td>
              <Link to={`/jobs/${j.id}`}>{j.id.slice(0, 8)}</Link>
            </td>
            <td>{j.module}</td>
            <td>
              <StatusBadge status={j.status} />
            </td>
            <td>
              {j.status === "queued" || j.status === "running" ? (
                <button
                  type="button"
                  onClick={async () => {
                    await api(`/jobs/${j.id}/cancel`, { method: "POST", body: "{}" });
                    onChanged?.();
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
