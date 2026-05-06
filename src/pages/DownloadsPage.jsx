import { useEffect, useState, useCallback } from "react";
import { listFiles, listMessages, downloadUrl } from "../api.js";

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function DownloadsPage() {
  const [files, setFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [fileData, messageData] = await Promise.all([
        listFiles(),
        listMessages(),
      ]);
      setFiles(Array.isArray(fileData) ? fileData : []);
      setMessages(Array.isArray(messageData) ? messageData : []);
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
      <section className="card">
        <h2>Shared text</h2>
        <button type="button" onClick={refresh}>Refresh</button>
        {error && <p className="muted" style={{ color: "var(--danger)" }}>{error}</p>}
        <ul className="messages public-messages">
          {loading && <li className="muted">Loading...</li>}
          {!loading && messages.length === 0 && !error && (
            <li className="muted">No text messages yet.</li>
          )}
          {messages.map((message) => (
            <li key={message.id}>
              <div className="message-bubble">
                <p>{message.text}</p>
                {message.created_at && (
                  <small className="muted">{formatDate(message.created_at)}</small>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Available files</h2>
        <p className="muted">Anyone with this link can download these files.</p>
        <ul className="files">
          {loading && <li className="muted">Loading...</li>}
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
    </>
  );
}
