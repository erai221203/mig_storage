import { ghHeaders, repoBase, dirPath, json } from "../_lib/github.js";

// GET /api/list  -> [{ name, size, path, download_url }]
export async function onRequestGet({ env }) {
  const dir = dirPath(env);
  const branch = env.GITHUB_BRANCH || "main";
  const url = `${repoBase(env)}/contents/${encodeURIComponent(dir)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: ghHeaders(env) });

  if (res.status === 404) return json([]);
  if (!res.ok) {
    return json(
      { error: "GitHub list failed", status: res.status, detail: await res.text() },
      { status: 502 }
    );
  }

  const data = await res.json();
  const items = Array.isArray(data) ? data : [];
  const files = items
    .filter((e) => e.type === "file")
    .map((e) => ({
      name: e.name,
      size: e.size,
      path: e.path,
      sha: e.sha,
      download_url: `/api/download/${encodeURIComponent(e.name)}`,
    }));

  return json(files);
}
