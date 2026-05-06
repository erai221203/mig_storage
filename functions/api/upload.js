import {
  ghHeaders,
  repoBase,
  filePath,
  bufferToBase64,
  getFileSha,
  json,
  requireAdmin,
} from "../_lib/github.js";

// POST /api/upload  (multipart/form-data with field "file")
export async function onRequestPost({ request, env }) {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return json({ error: "Missing 'file' field" }, { status: 400 });
  }

  const name = (form.get("name") || file.name || "upload.bin").toString();
  let path;
  try {
    path = filePath(env, name);
  } catch (e) {
    return json({ error: e.message }, { status: 400 });
  }

  const buf = await file.arrayBuffer();
  const content = bufferToBase64(buf);

  const branch = env.GITHUB_BRANCH || "main";
  const existingSha = await getFileSha(env, path);

  const url = `${repoBase(env)}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
  const body = {
    message: existingSha ? `Update ${path}` : `Add ${path}`,
    content,
    branch,
    ...(existingSha ? { sha: existingSha } : {}),
  };

  const res = await fetch(url, {
    method: "PUT",
    headers: { ...ghHeaders(env), "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return json(
      { error: "GitHub upload failed", status: res.status, detail: await res.text() },
      { status: 502 }
    );
  }

  const data = await res.json();
  return json({
    ok: true,
    name: path.split("/").pop(),
    path,
    size: file.size,
    sha: data.content?.sha,
    download_url: `/api/download/${encodeURIComponent(path.split("/").pop())}`,
  });
}
