import { useEffect, useState, useCallback } from "react";
import { listFiles, downloadUrl } from "../api.js";

export default function AdminPage() {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listFiles();
      setFiles(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <>
      <section className="hero card">
        <p className="kicker">Simple and clean</p>
        <h2>Welcome to your file library</h2>
        <p className="muted">
          Browse available files and download what you need in one click.
        </p>
        <button type="button" onClick={refresh}>Refresh files</button>
      </section>

      <section className="card">
        <h2>Available files</h2>
        {error && <p className="muted" style={{ color: "var(--danger)" }}>{error}</p>}
        <ul className="files">
          {loading && <li className="muted">Loading files...</li>}
          {!loading && files.length === 0 && !error && (
            <li className="muted">No files available right now.</li>
          )}
          {files.map((f) => (
            <li key={f.sha || f.name}>
              <span className="file-meta">
                <strong>{f.name}</strong>
                <small className="muted">{(f.size / 1024).toFixed(1)} KB</small>
              </span>
              <a className="btn" href={downloadUrl(f.name)}>Download</a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
