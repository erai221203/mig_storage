# GitHub File Portal (React + Cloudflare Pages)

A small React admin portal that:

- Has a landing page where you (the admin) upload files.
- Stores each file in a GitHub repo via the GitHub Contents API (real commits).
- Exposes a public **Downloads** page (`/files`) where anyone with the link can download those files.

- Frontend: **React 18 + Vite + React Router**, built to `dist/`.
- Backend: **Cloudflare Pages Functions** in `functions/` (no separate server).

## 1. Create the storage GitHub repo

1. Create a new GitHub repo (can be private), e.g. `file-storage`.
2. Create a Personal Access Token:
   - Recommended: **Fine-grained PAT** with **Repository access = only this repo** and permission **Contents: Read and write**.
   - Or a classic PAT with `repo` scope.

## 2. Push this project to its own GitHub repo

```bash
git init
git add .
git commit -m "Initial portal"
git branch -M main
git remote add origin https://github.com/<you>/<portal-repo>.git
git push -u origin main
```

## 3. Deploy on Cloudflare Pages

1. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
2. Pick the portal repo.
3. Build settings:
   - Framework preset: **Vite** (or *None*)
   - Build command: `npm run build`
   - Build output directory: `dist`
4. After the first deploy, open **Settings → Environment variables** and add (for **Production** and **Preview**):
   - `GITHUB_TOKEN` – the PAT (mark as *Encrypted/Secret*)
   - `GITHUB_OWNER` – your GitHub username or org
   - `GITHUB_REPO` – the storage repo name, e.g. `file-storage`
   - `GITHUB_BRANCH` – e.g. `main`
   - `GITHUB_DIR` – subfolder inside the repo, e.g. `uploads`
   - `ADMIN_PASSWORD` – password required for upload/delete (mark as *Encrypted/Secret*)
5. Trigger a redeploy so the Functions pick up the env vars.

## 4. Use it

- Admin / Upload page: `https://<your-project>.pages.dev/`
- Downloads page (share this link): `https://<your-project>.pages.dev/files`
- Direct download URL pattern: `https://<your-project>.pages.dev/api/download/<filename>`

## Local development

Two options:

**A. Full stack (recommended)** – build once, then run Pages dev so the Functions work too:

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in real values
npm run pages:dev
# open http://127.0.0.1:8788
```

Re-run `npm run build` whenever you change React code (or run `vite build --watch` in another tab).

**B. Vite dev server with API proxy** – fast HMR, but requires `wrangler pages dev` in another terminal:

```bash
# Terminal 1
npx wrangler pages dev dist --compatibility-date=2025-01-01
# Terminal 2
npm run dev
# open http://localhost:5173
```

## Limits & notes

- The GitHub Contents API caps individual file uploads at ~25 MB (hard limit 100 MB). The portal rejects files larger than 25 MB. For larger files, switch to Cloudflare R2.
- Filenames are sanitized to `[A-Za-z0-9._- ]`.
- Downloads are public by design (so the link can be shared elsewhere). To gate them too, add `requireAdmin` to `onRequestGet` in `functions/api/download/[name].js`.
- The admin password is checked server-side on every upload/delete request; the client only stores it in `sessionStorage`.
