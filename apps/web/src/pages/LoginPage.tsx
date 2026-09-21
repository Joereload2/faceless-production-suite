import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import styles from "../styles/app.module.css";

export function LoginPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  return (
    <main className={styles.page}>
      <h1>Entrar al estudio</h1>
      <p>Abre siempre http://127.0.0.1:5173 — nunca localhost</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await api("/auth/login", { method: "POST", body: JSON.stringify({ token }) });
            navigate("/");
          } catch (err) {
            setError(err instanceof Error ? err.message : "error");
          }
        }}
      >
        <label>
          Token del estudio
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <p>
          <button type="submit">Entrar</button>
        </p>
      </form>
      {error ? <p className={styles.warn}>{error}</p> : null}
    </main>
  );
}
