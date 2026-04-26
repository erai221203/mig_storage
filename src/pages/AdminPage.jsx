import { useEffect, useState, useCallback, useRef } from "react";
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
  const [uploadPercent, setUploadPercent] = useState(0);
  const uploadAbortRef = useRef(null);

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

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!busy) return undefined;

    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const onKeyDown = (event) => {
      const isRefreshKey =
        event.key === "F5" ||
        ((event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "r");

      if (!isRefreshKey) return;

      const leave = window.confirm(
        "Upload is in progress. Refreshing now will interrupt it. Continue?"
      );
      if (!leave) event.preventDefault();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [busy]);

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
    setUploadPercent(0);
    setUploadStatus({ msg: `Uploading ${file.name}…`, error: false });
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    try {
      const data = await uploadFile(file, {
        signal: controller.signal,
        onProgress: (percent) => setUploadPercent(percent),
      });
      setUploadPercent(100);
      setUploadStatus({ msg: `Uploaded: ${data.name}`, error: false });
      setFile(null);
      e.target.reset();
      await refresh();
    } catch (err) {
      if (err?.name === "AbortError") {
        setUploadStatus({ msg: "Upload cancelled.", error: true });
      } else {
        setUploadStatus({ msg: `Error: ${err.message}`, error: true });
      }
    } finally {
      uploadAbortRef.current = null;
      setBusy(false);
      setUploadPercent(0);
    }
  };

  const onCancelUpload = () => {
    uploadAbortRef.current?.abort();
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
          <button
            type="submit"
            disabled={busy}
            className={busy ? "upload-progress-btn" : undefined}
            style={busy ? { "--upload-progress": `${uploadPercent}%` } : undefined}
          >
            {busy ? `Uploading ${uploadPercent}%` : "Upload to GitHub"}
          </button>
          {busy && (
            <button type="button" className="ghost" onClick={onCancelUpload}>
              Cancel upload
            </button>
          )}
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
