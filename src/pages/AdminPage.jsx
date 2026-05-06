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

function plural(count, singular, pluralValue = `${singular}s`) {
  return count === 1 ? singular : pluralValue;
}

export default function AdminPage() {
  const [pw, setPw] = useState("");
  const [hasPw, setHasPw] = useState(Boolean(getPassword()));
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState({ msg: "", error: false });
  const [files, setFiles] = useState([]);
  const [listError, setListError] = useState("");
  const [selectedFileNames, setSelectedFileNames] = useState([]);
  const [bulkFileBusy, setBulkFileBusy] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messagesError, setMessagesError] = useState("");
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [bulkMessageBusy, setBulkMessageBusy] = useState(false);
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
    setSelectedFileNames((selected) =>
      selected.filter((name) => files.some((fileItem) => fileItem.name === name))
    );
  }, [files]);

  useEffect(() => {
    setSelectedMessageIds((selected) =>
      selected.filter((id) => messages.some((message) => message.id === id))
    );
  }, [messages]);

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort();
    };
  }, []);

  const runUpload = useCallback(
    async (filesToUpload) => {
      const batch = Array.from(filesToUpload || []);
      if (batch.length === 0) return;
      if (!getPassword()) {
        setUploadStatus({ msg: "Set the admin password first.", error: true });
        return;
      }

      setBusy(true);
      setUploadPercent(0);
      setUploadStatus({
        msg:
          batch.length === 1
            ? `Uploading ${batch[0].name}...`
            : `Uploading 1 of ${batch.length}: ${batch[0].name}`,
        error: false,
      });

      const controller = new AbortController();
      uploadAbortRef.current = controller;
      let uploaded = 0;

      try {
        for (const currentFile of batch) {
          setUploadStatus({
            msg:
              batch.length === 1
                ? `Uploading ${currentFile.name}...`
                : `Uploading ${uploaded + 1} of ${batch.length}: ${currentFile.name}`,
            error: false,
          });

          await uploadFile(currentFile, {
            signal: controller.signal,
            onProgress: (percent) => {
              const totalPercent = Math.round(
                ((uploaded + percent / 100) / batch.length) * 100
              );
              setUploadPercent(Math.min(100, totalPercent));
            },
          });

          uploaded += 1;
        }

        setUploadPercent(100);
        setUploadStatus({
          msg:
            uploaded === 1
              ? `Uploaded: ${batch[0].name}`
              : `Uploaded ${uploaded} files.`,
          error: false,
        });
        setSelectedFiles([]);
        formRef.current?.reset();
        await refresh();
      } catch (err) {
        if (err?.name === "AbortError") {
          setUploadStatus({
            msg:
              uploaded > 0
                ? `Upload cancelled after ${uploaded} of ${batch.length} files.`
                : "Upload cancelled.",
            error: true,
          });
        } else {
          setUploadStatus({
            msg:
              uploaded > 0
                ? `Error after ${uploaded} of ${batch.length} files: ${err.message}`
                : `Error: ${err.message}`,
            error: true,
          });
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
    if (selectedFiles.length === 0) return;
    await runUpload(selectedFiles);
  };

  const onCancelUpload = () => {
    uploadAbortRef.current?.abort();
  };

  const onFileChange = (e) => {
    setSelectedFiles(Array.from(e.target.files || []));
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

  const toggleFileSelection = (name) => {
    setSelectedFileNames((selected) =>
      selected.includes(name)
        ? selected.filter((selectedName) => selectedName !== name)
        : [...selected, name]
    );
  };

  const toggleAllFiles = () => {
    setSelectedFileNames((selected) =>
      selected.length === files.length ? [] : files.map((fileItem) => fileItem.name)
    );
  };

  const onDeleteSelectedFiles = async () => {
    const names = selectedFileNames;
    if (names.length === 0) return;
    if (!getPassword()) return alert("Set the admin password first.");
    if (!confirm(`Delete ${names.length} selected ${plural(names.length, "file")}?`)) {
      return;
    }

    setBulkFileBusy(true);
    try {
      for (const name of names) {
        await deleteFile(name);
      }
      setSelectedFileNames([]);
      await refresh();
    } catch (err) {
      alert(err.message);
      await refresh();
    } finally {
      setBulkFileBusy(false);
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

  const toggleMessageSelection = (id) => {
    setSelectedMessageIds((selected) =>
      selected.includes(id)
        ? selected.filter((selectedId) => selectedId !== id)
        : [...selected, id]
    );
  };

  const toggleAllMessages = () => {
    setSelectedMessageIds((selected) =>
      selected.length === messages.length
        ? []
        : messages.map((message) => message.id)
    );
  };

  const onDeleteSelectedMessages = async () => {
    const ids = selectedMessageIds;
    if (ids.length === 0) return;
    if (!getPassword()) return alert("Set the admin password first.");
    if (!confirm(`Delete ${ids.length} selected ${plural(ids.length, "chat")}?`)) {
      return;
    }

    setBulkMessageBusy(true);
    try {
      for (const id of ids) {
        await deleteMessage(id);
      }
      setSelectedMessageIds([]);
      await refreshMessages();
    } catch (err) {
      alert(err.message);
      await refreshMessages();
    } finally {
      setBulkMessageBusy(false);
    }
  };

  const allFilesSelected =
    files.length > 0 && selectedFileNames.length === files.length;
  const allMessagesSelected =
    messages.length > 0 && selectedMessageIds.length === messages.length;

  return (
    <>
      <section className="card">
        <h2>Admin login</h2>
        <p className="muted">
          Enter the admin password to upload, download, or delete files and
          chats. The password is kept only in your browser session.
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
        <h2>Upload files</h2>
        <form ref={formRef} onSubmit={onUpload}>
          <input
            type="file"
            multiple
            required
            onChange={onFileChange}
          />
          <button
            type="submit"
            disabled={busy || selectedFiles.length === 0}
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
        {selectedFiles.length > 0 && !busy && (
          <p className="muted">
            {selectedFiles.length} {plural(selectedFiles.length, "file")} selected.
          </p>
        )}
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
        <div className="bulk-actions">
          <label className="checkline">
            <input
              type="checkbox"
              checked={allMessagesSelected}
              disabled={messages.length === 0}
              onChange={toggleAllMessages}
            />
            Select all chats
          </label>
          <button
            type="button"
            className="danger"
            disabled={selectedMessageIds.length === 0 || bulkMessageBusy}
            onClick={onDeleteSelectedMessages}
          >
            {bulkMessageBusy
              ? "Deleting..."
              : `Delete selected (${selectedMessageIds.length})`}
          </button>
        </div>
        <ul className="messages">
          {messages.length === 0 && !messagesError && (
            <li className="muted">No text messages yet.</li>
          )}
          {messages.map((message) => (
            <li key={message.id}>
              <label className="selectable message-select">
                <input
                  type="checkbox"
                  checked={selectedMessageIds.includes(message.id)}
                  onChange={() => toggleMessageSelection(message.id)}
                />
                <div className="message-bubble">
                  <p>{message.text}</p>
                  {message.created_at && (
                    <small className="muted">{formatDate(message.created_at)}</small>
                  )}
                </div>
              </label>
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
        <div className="bulk-actions">
          <button type="button" onClick={refresh}>Refresh</button>
          <label className="checkline">
            <input
              type="checkbox"
              checked={allFilesSelected}
              disabled={files.length === 0}
              onChange={toggleAllFiles}
            />
            Select all files
          </label>
          <button
            type="button"
            className="danger"
            disabled={selectedFileNames.length === 0 || bulkFileBusy}
            onClick={onDeleteSelectedFiles}
          >
            {bulkFileBusy
              ? "Deleting..."
              : `Delete selected (${selectedFileNames.length})`}
          </button>
        </div>
        {listError && <p className="muted" style={{ color: "var(--danger)" }}>{listError}</p>}
        <ul className="files">
          {files.length === 0 && !listError && (
            <li className="muted">No files yet.</li>
          )}
          {files.map((f) => (
            <li key={f.sha || f.name}>
              <label className="selectable">
                <input
                  type="checkbox"
                  checked={selectedFileNames.includes(f.name)}
                  onChange={() => toggleFileSelection(f.name)}
                />
                <span>
                  {f.name}{" "}
                  <small className="muted">({(f.size / 1024).toFixed(1)} KB)</small>
                </span>
              </label>
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
