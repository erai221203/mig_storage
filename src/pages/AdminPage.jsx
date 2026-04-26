import { useEffect, useState, useCallback } from "react";
import {
  getPassword,
  setPassword,
  clearPassword,
  listFiles,
  uploadFile,
  deleteFile,
  downloadUrl,
} from "../api.js";

export default function AdminPage() {
  const [pw, setPw] = useState("");
  const [hasPw, setHasPw] = useState(Boolean(getPassword()));
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState({ msg: "", error: false });
  const [files, setFiles] = useState([]);
  const [listError, setListError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setListError("");
      const data = await listFiles();
      setFiles(Array.isArray(data) ? data : []);
    } catch (e) {
      setListError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onSaveAuth = () => {
    if (!pw.trim()) return;
    setPassword(pw.trim());
    setPw("");
    setHasPw(true);
  };

  const onClearAuth = () => {
    clearPassword();
    setHasPw(false);
  };

  const onUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    if (!getPassword()) {
      setUploadStatus({ msg: "Set the admin password first.", error: true });
      return;
    }
    setBusy(true);
    setUploadStatus({ msg: `Uploading ${file.name}…`, error: false });
    try {
      const data = await uploadFile(file);
      setUploadStatus({ msg: `Uploaded: ${data.name}`, error: false });
      setFile(null);
      e.target.reset();
      await refresh();
    } catch (err) {
      setUploadStatus({ msg: `Error: ${err.message}`, error: true });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (name) => {
    if (!getPassword()) return alert("Set the admin password first.");
    if (!confirm(`Delete ${name}?`)) return;
    try {
      await deleteFile(name);
      await refresh();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <>
      <section className="card">
        <h2>Admin login</h2>
        <p className="muted">
          Enter the admin password to upload or delete files. The password is
          kept only in your browser session.
        </p>
        <div className="row">
          <input
            type="password"
            placeholder="Admin password"
            autoComplete="current-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <button type="button" onClick={onSaveAuth}>Save</button>
          <button type="button" className="ghost" onClick={onClearAuth}>Clear</button>
        </div>
        <p className="muted">
          {hasPw
            ? "Admin password is set for this session."
            : "No admin password set."}
        </p>
      </section>

      <section className="card">
        <h2>Upload a file</h2>
        <form onSubmit={onUpload}>
          <input
            type="file"
            required
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button type="submit" disabled={busy}>
            {busy ? "Uploading…" : "Upload to GitHub"}
          </button>
        </form>
        {uploadStatus.msg && (
          <p
            className="muted"
            style={{ color: uploadStatus.error ? "var(--danger)" : undefined }}
          >
            {uploadStatus.msg}
          </p>
        )}
      </section>

      <section className="card">
        <h2>Files in repo</h2>
        <button type="button" onClick={refresh}>Refresh</button>
        {listError && <p className="muted" style={{ color: "var(--danger)" }}>{listError}</p>}
        <ul className="files">
          {files.length === 0 && !listError && (
            <li className="muted">No files yet.</li>
          )}
          {files.map((f) => (
            <li key={f.sha || f.name}>
              <span>
                {f.name}{" "}
                <small className="muted">({(f.size / 1024).toFixed(1)} KB)</small>
              </span>
              <span className="actions">
                <a className="btn" href={downloadUrl(f.name)}>Download</a>
                <button
                  type="button"
                  className="danger"
                  onClick={() => onDelete(f.name)}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
