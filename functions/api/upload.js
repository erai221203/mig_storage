import {
  ghHeaders,
  repoBase,
  filePath,
  bufferToBase64,
  getFileSha,
  json,
} from "../_lib/github.js";

// POST /api/upload
// Preferred: raw file body + x-file-name header.
// Fallback: multipart/form-data with field "file" for compatibility.
export async function onRequestPost({ request, env }) {
  const rawName = request.headers.get("x-file-name");
  let name = "";
  let buf;
  let fileSize = 0;

  if (rawName) {
    try {
      name = decodeURIComponent(rawName);
    } catch {
      name = rawName;
    }
    buf = await request.arrayBuffer();
    fileSize = buf.byteLength;
  } else {
    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ error: "Expected file body or multipart/form-data" }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json({ error: "Missing 'file' field" }, { status: 400 });
    }
    name = (form.get("name") || file.name || "upload.bin").toString();
    buf = await file.arrayBuffer();
    fileSize = file.size;
  }

  let path;
  try {
    path = filePath(env, name);
  } catch (e) {
    return json({ error: e.message }, { status: 400 });
  }

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
    size: fileSize,
    sha: data.content?.sha,
    download_url: `/api/download?name=${encodeURIComponent(path.split("/").pop())}`,
  });
}
