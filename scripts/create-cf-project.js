#!/usr/bin/env node
/**
 * Ensures the Cloudflare Pages project exists before wrangler deploy runs.
 * Uses the same CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID that wrangler uses.
 */

const PROJECT_NAME = "migrator";
const PRODUCTION_BRANCH = "main";

const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!token) {
  console.error("❌  CLOUDFLARE_API_TOKEN is not set.");
  process.exit(1);
}
if (!accountId) {
  console.error("❌  CLOUDFLARE_ACCOUNT_ID is not set.");
  process.exit(1);
}

const BASE = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`;
const headers = {
  "Authorization": `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function run() {
  // 1. Check if project already exists
  const check = await fetch(`${BASE}/${PROJECT_NAME}`, { headers });
  if (check.ok) {
    console.log(`✅  Project "${PROJECT_NAME}" already exists — skipping creation.`);
    return;
  }

  const errBody = await check.json().catch(() => ({}));
  const code = errBody?.errors?.[0]?.code;

  // code 8000007 = project not found — safe to create
  if (check.status !== 404 && code !== 8000007) {
    console.error(`❌  Unexpected API response (${check.status}):`, JSON.stringify(errBody));
    process.exit(1);
  }

  // 2. Create the project
  console.log(`🚀  Creating Cloudflare Pages project "${PROJECT_NAME}"...`);
  const create = await fetch(BASE, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: PROJECT_NAME,
      production_branch: PRODUCTION_BRANCH,
    }),
  });

  const createBody = await create.json();
  if (!create.ok) {
    console.error("❌  Failed to create project:", JSON.stringify(createBody));
    process.exit(1);
  }

  console.log(`✅  Project "${PROJECT_NAME}" created successfully!`);
}

run().catch((err) => {
  console.error("❌  Script error:", err);
  process.exit(1);
});
