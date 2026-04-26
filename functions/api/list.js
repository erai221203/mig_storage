import { ghHeaders, repoBase, dirPath, json } from "../_lib/github.js";

// GET /api/list  -> [{ name, size, path, download_url }]
export async function onRequestGet({ env }) {
  try {
    const dir = dirPath(env);
    const branch = env.GITHUB_BRANCH || "main";
    const encodedDir = encodeURIComponent(dir).replace(/%2F/g, "/");
    const url = `${repoBase(env)}/contents/${encodedDir}?ref=${encodeURIComponent(branch)}`;
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
  } catch (error) {
    return json(
      {
        error: "GitHub list failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
