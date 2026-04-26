const KEY = "gh-portal-pw";

export const getPassword = () => sessionStorage.getItem(KEY) || "";
export const setPassword = (v) => sessionStorage.setItem(KEY, v);
export const clearPassword = () => sessionStorage.removeItem(KEY);

export async function listFiles() {
  const r = await fetch("/api/list");
  if (!r.ok) throw new Error(`List failed: ${r.status}`);
  return r.json();
}

export async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/upload", {
    method: "POST",
    headers: { "x-admin-password": getPassword() },
    body: fd,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Upload failed (${r.status})`);
  return data;
}

export async function deleteFile(name) {
  const r = await fetch(`/api/download/${encodeURIComponent(name)}`, {
    method: "DELETE",
    headers: { "x-admin-password": getPassword() },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Delete failed (${r.status})`);
  return data;
}

export const downloadUrl = (name) => `/api/download/${encodeURIComponent(name)}`;
