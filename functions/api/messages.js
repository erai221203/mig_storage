import {
  ghHeaders,
  repoBase,
  messagesPath,
  bufferToBase64,
  json,
  requireAdmin,
} from "../_lib/github.js";

const MAX_MESSAGE_LENGTH = 10000;
const MAX_MESSAGES = 200;

function githubContentUrl(env, path) {
  const branch = env.GITHUB_BRANCH || "main";
  return `${repoBase(env)}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`;
}

function githubWriteUrl(env, path) {
  return `${repoBase(env)}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
}

function decodeBase64Json(content) {
  const bin = atob(content.replace(/\n/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function loadMessages(env) {
  const path = messagesPath(env);
  const res = await fetch(githubContentUrl(env, path), {
    headers: ghHeaders(env),
  });

  if (res.status === 404) return { path, sha: null, messages: [] };
  if (!res.ok) {
    throw new Error(`GitHub error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  let parsed = [];
  if (data.encoding === "base64" && data.content) {
    parsed = decodeBase64Json(data.content);
  }

  const messages = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.messages)
      ? parsed.messages
      : [];

  return { path, sha: data.sha || null, messages };
}

async function saveMessages(env, path, sha, messages) {
  const branch = env.GITHUB_BRANCH || "main";
  const payload = JSON.stringify({ messages }, null, 2);
  const content = bufferToBase64(new TextEncoder().encode(payload));
  const body = {
    message: sha ? "Update shared messages" : "Add shared messages",
    content,
    branch,
    ...(sha ? { sha } : {}),
  };

  const res = await fetch(githubWriteUrl(env, path), {
    method: "PUT",
    headers: { ...ghHeaders(env), "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`GitHub save failed ${res.status}: ${await res.text()}`);
  }
}

function normalizeMessage(raw) {
  return {
    id: String(raw.id || ""),
    text: String(raw.text || ""),
    created_at: String(raw.created_at || ""),
  };
}

// GET /api/messages -> [{ id, text, created_at }]
export async function onRequestGet({ env }) {
  try {
    const { messages } = await loadMessages(env);
    return json(messages.map(normalizeMessage));
  } catch (e) {
    return json(
      { error: "GitHub messages fetch failed", detail: e.message },
      { status: 502 }
    );
  }
}

// POST /api/messages  JSON body: { "text": "..." }
export async function onRequestPost({ request, env }) {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Expected JSON body" }, { status: 400 });
  }

  const text = String(body.text || "").trim();
  if (!text) return json({ error: "Message text is required" }, { status: 400 });
  if (text.length > MAX_MESSAGE_LENGTH) {
    return json(
      { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or less` },
      { status: 400 }
    );
  }

  try {
    const { path, sha, messages } = await loadMessages(env);
    const message = {
      id:
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      created_at: new Date().toISOString(),
    };
    const nextMessages = [...messages.map(normalizeMessage), message].slice(
      -MAX_MESSAGES
    );
    await saveMessages(env, path, sha, nextMessages);
    return json({ ok: true, message });
  } catch (e) {
    return json(
      { error: "GitHub message save failed", detail: e.message },
      { status: 502 }
    );
  }
}

// DELETE /api/messages?id=<message-id>
export async function onRequestDelete({ request, env }) {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return json({ error: "Missing 'id' query parameter" }, { status: 400 });

  try {
    const { path, sha, messages } = await loadMessages(env);
    const nextMessages = messages
      .map(normalizeMessage)
      .filter((message) => message.id !== id);

    if (nextMessages.length === messages.length) {
      return json({ error: "Not found" }, { status: 404 });
    }

    await saveMessages(env, path, sha, nextMessages);
    return json({ ok: true });
  } catch (e) {
    return json(
      { error: "GitHub message delete failed", detail: e.message },
      { status: 502 }
    );
  }
}
