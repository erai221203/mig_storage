const KEY = "gh-portal-pw";

export const getPassword = () => sessionStorage.getItem(KEY) || "";
export const setPassword = (v) => sessionStorage.setItem(KEY, v);
export const clearPassword = () => sessionStorage.removeItem(KEY);

export async function listFiles() {
  const r = await fetch("/api/list");
  if (!r.ok) throw new Error(`List failed: ${r.status}`);
  return r.json();
}

export async function uploadFile(file, options = {}) {
  const fd = new FormData();
  fd.append("file", file);

  const uploadWithXhr = () =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      xhr.timeout = options.timeoutMs ?? 10 * 60 * 1000;

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || typeof options.onProgress !== "function") return;
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        options.onProgress(percent);
      };

      xhr.onload = () => {
        let data = {};
        try {
          data = JSON.parse(xhr.responseText || "{}");
        } catch {
          data = {};
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
          return;
        }
        reject(new Error(data.error || `Upload failed (${xhr.status})`));
      };

      xhr.onerror = () => {
        reject(new Error("Upload failed (network error)"));
      };

      xhr.ontimeout = () => {
        reject(new Error("Upload failed (request timed out)"));
      };

      xhr.onabort = () => {
        reject(new DOMException("Upload aborted", "AbortError"));
      };

      if (options.signal) {
        if (options.signal.aborted) {
          xhr.abort();
          return;
        }
        options.signal.addEventListener("abort", () => xhr.abort(), { once: true });
      }

      xhr.send(fd);
    });

  const uploadWithFetch = async () => {
    const r = await fetch("/api/upload", {
      method: "POST",
      body: fd,
      signal: options.signal,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Upload failed (${r.status})`);
    return data;
  };

  try {
    return await uploadWithXhr();
  } catch (err) {
    // Some browsers/CDN paths can fail large HTTP/2 uploads with low-level transport
    // errors; retry once via fetch as a fallback transport.
    if (err?.name === "AbortError") throw err;
    return uploadWithFetch();
  }
}

export async function deleteFile(name) {
  const r = await fetch(`/api/download?name=${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Delete failed (${r.status})`);
  return data;
}

export const downloadUrl = (name) => `/api/download?name=${encodeURIComponent(name)}`;
