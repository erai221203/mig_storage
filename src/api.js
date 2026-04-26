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

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.setRequestHeader("x-admin-password", getPassword());

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
      reject(
        new Error(
          "Upload failed (network reset/blocked). Try a smaller file (<= 25 MB) or retry."
        )
      );
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
