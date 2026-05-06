// Shared helpers for Cloudflare Pages Functions talking to the GitHub Contents API.

const GH_API = "https://api.github.com";

export function ghHeaders(env) {
  return {
    "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "github-file-portal",
  };
}

export function repoBase(env) {
  return `${GH_API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
}

export function dirPath(env) {
  return (env.GITHUB_DIR || "uploads").replace(/^\/+|\/+$/g, "");
}

export function filePath(env, name) {
  const safe = sanitizeName(name);
  const dir = dirPath(env);
  return dir ? `${dir}/${safe}` : safe;
}

export const MESSAGES_FILE = "_messages.json";

export function messagesPath(env) {
  const dir = dirPath(env);
  return dir ? `${dir}/${MESSAGES_FILE}` : MESSAGES_FILE;
}

export function isMessagesFileName(name) {
  try {
    return sanitizeName(name) === MESSAGES_FILE;
  } catch {
    return false;
  }
}

// Allow letters, digits, dot, dash, underscore, space. Strip path separators.
export function sanitizeName(name) {
  const base = String(name).split(/[\\/]/).pop() || "";
  const cleaned = base.replace(/[^A-Za-z0-9._\- ]/g, "_").trim();
  if (!cleaned || cleaned === "." || cleaned === "..") {
    throw new Error("Invalid file name");
  }
  return cleaned;
}

export function requireAdmin(request, env) {
  const supplied =
    request.headers.get("x-admin-password") ||
    new URL(request.url).searchParams.get("password");
  if (!env.ADMIN_PASSWORD || supplied !== env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return null;
}

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
  });
}

// Convert an ArrayBuffer to base64 (chunked to avoid stack overflow on big files).
export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunkSize)
    );
  }
  return btoa(binary);
}

export async function getFileSha(env, path) {
  const url = `${repoBase(env)}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(env.GITHUB_BRANCH || "main")}`;
  const res = await fetch(url, { headers: ghHeaders(env) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.sha || null;
}
