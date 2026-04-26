import {
  ghHeaders,
  repoBase,
  filePath,
  getFileSha,
  requireAdmin,
  json,
} from "../../_lib/github.js";

// GET    /api/download/:name  -> streams file bytes back to the browser
// DELETE /api/download/:name  -> deletes file (admin only)
export async function onRequestGet({ params, env }) {
  let path;
  try {
    path = filePath(env, params.name);
  } catch (e) {
    return json({ error: e.message }, { status: 400 });
  }

  const branch = env.GITHUB_BRANCH || "main";
  const url = `${repoBase(env)}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`;
  const meta = await fetch(url, { headers: ghHeaders(env) });

  if (meta.status === 404) return json({ error: "Not found" }, { status: 404 });
  if (!meta.ok) {
    return json(
      { error: "GitHub fetch failed", status: meta.status },
      { status: 502 }
    );
  }

  const info = await meta.json();
  const filename = info.name || path.split("/").pop();

  // Prefer raw blob to support binary files of any encoding.
  const raw = await fetch(info.git_url || info.url, {
    headers: { ...ghHeaders(env), Accept: "application/vnd.github.raw" },
  });

  if (!raw.ok) {
    // Fallback: decode base64 from the JSON response.
    if (info.encoding === "base64" && info.content) {
      const bin = atob(info.content.replace(/\n/g, ""));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Response(bytes, {
        headers: {
          "content-type": "application/octet-stream",
          "content-disposition": `attachment; filename="${filename}"`,
          "cache-control": "no-store",
        },
      });
    }
    return json({ error: "Could not fetch file blob" }, { status: 502 });
  }

  return new Response(raw.body, {
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

export async function onRequestDelete({ request, params, env }) {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;

  let path;
  try {
    path = filePath(env, params.name);
  } catch (e) {
    return json({ error: e.message }, { status: 400 });
  }

  const sha = await getFileSha(env, path);
  if (!sha) return json({ error: "Not found" }, { status: 404 });

  const branch = env.GITHUB_BRANCH || "main";
  const url = `${repoBase(env)}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { ...ghHeaders(env), "content-type": "application/json" },
    body: JSON.stringify({ message: `Delete ${path}`, sha, branch }),
  });

  if (!res.ok) {
    return json(
      { error: "GitHub delete failed", status: res.status, detail: await res.text() },
      { status: 502 }
    );
  }
  return json({ ok: true });
}
