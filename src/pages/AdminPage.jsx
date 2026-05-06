import { useEffect, useState, useCallback, useRef } from "react";
import {
  getPassword,
  setPassword,
  clearPassword,
  listFiles,
  listMessages,
  uploadFile,
  deleteFile,
  downloadFile,
  sendMessage,
  deleteMessage,
} from "../api.js";

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function AdminPage() {
  const [pw, setPw] = useState("");
  const [hasPw, setHasPw] = useState(Boolean(getPassword()));
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState({ msg: "", error: false });
  const [files, setFiles] = useState([]);
  const [listError, setListError] = useState("");
  const [messages, setMessages] = useState([]);
  const [messagesError, setMessagesError] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messageStatus, setMessageStatus] = useState({ msg: "", error: false });
  const [messageBusy, setMessageBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const uploadAbortRef = useRef(null);
  const formRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      setListError("");
      const data = await listFiles();
      setFiles(Array.isArray(data) ? data : []);
    } catch (e) {
      setListError(e.message);
    }
  }, []);

  const refreshMessages = useCallback(async () => {
    try {
      setMessagesError("");
      const data = await listMessages();
      setMessages(Array.isArray(data) ? data : []);
    } catch (e) {
      setMessagesError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    refreshMessages();
  }, [refresh, refreshMessages]);

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort();
    };
  }, []);

  const runUpload = useCallback(
    async (selectedFile) => {
      if (!selectedFile) return;
      if (!getPassword()) {
        setUploadStatus({ msg: "Set the admin password first.", error: true });
        return;
      }

      setBusy(true);
      setUploadPercent(0);
      setUploadStatus({
        msg: `Uploading ${selectedFile.name}…`,
        error: false,
      });

      const controller = new AbortController();
      uploadAbortRef.current = controller;

      try {
        const data = await uploadFile(selectedFile, {
          signal: controller.signal,
          onProgress: (percent) => setUploadPercent(percent),
        });
        setUploadPercent(100);
        setUploadStatus({ msg: `Uploaded: ${data.name}`, error: false });
        setFile(null);
        formRef.current?.reset();
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
    },
    [refresh]
  );

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
    await runUpload(file);
  };

  const onCancelUpload = () => {
    uploadAbortRef.current?.abort();
  };

  const onFileChange = (e) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
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

  const onDownload = async (name) => {
    try {
      await downloadFile(name);
    } catch (err) {
      alert(err.message);
    }
  };

  const onSendMessage = async (e) => {
    e.preventDefault();
    const text = messageText.trim();
    if (!text) return;
    if (!getPassword()) {
      setMessageStatus({ msg: "Set the admin password first.", error: true });
      return;
    }

    setMessageBusy(true);
    setMessageStatus({ msg: "Sending text...", error: false });
    try {
      await sendMessage(text);
      setMessageText("");
      setMessageStatus({ msg: "Text shared.", error: false });
      await refreshMessages();
    } catch (err) {
      setMessageStatus({ msg: `Error: ${err.message}`, error: true });
    } finally {
      setMessageBusy(false);
    }
  };

  const onDeleteMessage = async (message) => {
    if (!getPassword()) return alert("Set the admin password first.");
    const preview =
      message.text.length > 60 ? `${message.text.slice(0, 60)}...` : message.text;
    if (!confirm(`Delete this text?\n\n${preview}`)) return;

    try {
      await deleteMessage(message.id);
      await refreshMessages();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <>
      <section className="card">
        <h2>Admin login</h2>
        <p className="muted">
          Enter the admin password to upload, download, or delete files. The
          password is kept only in your browser session.
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
        <form ref={formRef} onSubmit={onUpload}>
          <input
            type="file"
            required
            onChange={onFileChange}
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
        <h2>Share text</h2>
        <form className="message-form" onSubmit={onSendMessage}>
          <textarea
            placeholder="Type text to share"
            value={messageText}
            maxLength={10000}
            onChange={(e) => setMessageText(e.target.value)}
          />
          <div className="row">
            <button type="submit" disabled={messageBusy || !messageText.trim()}>
              {messageBusy ? "Sending..." : "Send text"}
            </button>
            <button type="button" className="ghost" onClick={refreshMessages}>
              Refresh
            </button>
          </div>
        </form>
        {messageStatus.msg && (
          <p
            className="muted"
            style={{ color: messageStatus.error ? "var(--danger)" : undefined }}
          >
            {messageStatus.msg}
          </p>
        )}
        {messagesError && (
          <p className="muted" style={{ color: "var(--danger)" }}>
            {messagesError}
          </p>
        )}
        <ul className="messages">
          {messages.length === 0 && !messagesError && (
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
              <button
                type="button"
                className="danger"
                onClick={() => onDeleteMessage(message)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
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
                <button type="button" onClick={() => onDownload(f.name)}>
                  Download
                </button>
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
