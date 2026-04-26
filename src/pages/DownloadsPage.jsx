import { useEffect, useState, useCallback } from "react";
import { listFiles, downloadUrl } from "../api.js";

export default function DownloadsPage() {
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
    <section className="card">
      <h2>Available files</h2>
      <p className="muted">Anyone with this link can download these files.</p>
      <button type="button" onClick={refresh}>Refresh</button>
      {error && <p className="muted" style={{ color: "var(--danger)" }}>{error}</p>}
      <ul className="files">
        {loading && <li className="muted">Loading…</li>}
        {!loading && files.length === 0 && !error && (
          <li className="muted">No files yet.</li>
        )}
        {files.map((f) => (
          <li key={f.sha || f.name}>
            <span>
              {f.name}{" "}
              <small className="muted">({(f.size / 1024).toFixed(1)} KB)</small>
            </span>
            <a className="btn" href={downloadUrl(f.name)}>Download</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
