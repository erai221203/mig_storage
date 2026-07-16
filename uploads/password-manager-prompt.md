# Detailed Prompt: Secure Password Manager Tool

Copy everything below the line and paste it into your AI coding tool (Claude Code, Cursor, etc.) or hand it to a developer.

---

## Project Brief

Develop a **fully functional, secure, and responsive password manager** web application with a **zero-knowledge architecture** — the server must never be able to read the user's stored passwords. Include **dark and light themes**, a polished modern UI, and strong cryptography throughout.

---

## 1. Tech Stack

- **Frontend:** React 18+ with TypeScript, Vite
- **Styling:** Tailwind CSS with CSS-variable design tokens for theming
- **Crypto:** Web Crypto API (SubtleCrypto) in the browser — no home-rolled crypto
- **Backend:** Node.js + Express (or serverless functions)
- **Database:** PostgreSQL with Prisma ORM (stores only encrypted blobs + metadata)
- **Auth:** SRP or standard email/password where the password never leaves the client in plaintext-usable form; JWT in httpOnly cookies with refresh rotation
- **Optional desktop/mobile:** structure the core crypto and state logic as a framework-agnostic package so it can later be wrapped in Electron/Capacitor

## 2. Zero-Knowledge Cryptography Design (non-negotiable)

- **Master password** is never sent to the server.
- Derive two keys from the master password client-side:
  - **Auth key:** Argon2id (or PBKDF2 ≥ 600k iterations) with a per-user salt → sent to server for login verification (server stores only its hash).
  - **Encryption key:** separately derived (different salt/info via HKDF) → used to wrap a randomly generated **vault key**.
- **Vault key** (random 256-bit) encrypts all vault items with **AES-256-GCM**, unique IV per item; the wrapped vault key is stored server-side so the master password can be changed without re-encrypting everything.
- All encryption/decryption happens **in the browser**; the server stores ciphertext only.
- Zeroize keys in memory where possible; never write plaintext secrets to localStorage, logs, or analytics.

## 3. Core Features

1. **Vault items:** logins (site, username, password, URL, notes), secure notes, credit cards, and identities. Custom fields supported.
2. **Add / edit / delete / duplicate** items with client-side validation.
3. **Folders and tags** for organization; favorites; drag-to-organize.
4. **Search** — instant, client-side, over decrypted items in memory.
5. **Password generator** — configurable length (8–128), character sets, passphrase mode (diceware-style words), strength meter (zxcvbn).
6. **Copy to clipboard** with automatic clipboard clear after 15 seconds and a visible countdown.
7. **Show/hide password** toggle with auto-rehide after 10 seconds.
8. **Password health dashboard:** flag weak, reused, and old passwords; overall security score.
9. **Breach check:** integrate HaveIBeenPwned k-anonymity API (send only the first 5 chars of the SHA-1 hash — never the password).
10. **Import/export:** CSV import from common managers (Chrome, Bitwarden, LastPass formats); encrypted JSON export protected by a passphrase.
11. **URL matching:** open site + autofill-ready copy actions from each login item.

## 4. Security & Session Behavior

- **Auto-lock** the vault after configurable inactivity (default 5 min), on tab close, and on system sleep; require master password (or unlock PIN) to resume.
- **Two-factor authentication:** TOTP (RFC 6238) with QR enrollment and recovery codes.
- **Rate limiting** and progressive lockout on login attempts; audit log of logins and vault unlocks (timestamp, IP, device).
- **Security headers:** strict CSP (no inline scripts), HSTS, X-Frame-Options DENY, X-Content-Type-Options.
- CSRF protection; SameSite=Strict cookies; input validation with Zod on client and server.
- No secrets in URLs, logs, or error messages; generic auth error responses.
- **Master password reset is impossible by design** — show clear warnings at signup and offer an optional printable **emergency recovery kit** (recovery key that wraps the vault key).

## 5. UI / UX Requirements

- **Dark and light themes:** toggle in the header, respect `prefers-color-scheme`, persist choice, no theme flash on load, WCAG AA contrast in both.
- Fully **responsive**: three-pane layout on desktop (sidebar → item list → item detail), collapsing to stacked navigation on mobile.
- Clean, trustworthy visual design — generous whitespace, clear typography, distinct lock/unlock states, subtle animations that respect `prefers-reduced-motion`.
- Keyboard-first support: shortcuts for search (/), new item (N), copy password (Ctrl/Cmd+C on selection), lock (Ctrl/Cmd+L).
- Empty states, skeleton loaders, optimistic UI for edits, undo toast on delete (soft delete with 30-day trash).
- Onboarding flow: create account → set master password with live strength feedback → generate recovery kit → guided first item.

## 6. Admin / Account Settings

- Change master password (client-side re-wrap of vault key), manage 2FA, active sessions list with remote revoke, delete account (with typed confirmation and full data purge).
- Vault statistics: item counts, storage used, last backup/export date.

## 7. Code Quality & Deliverables

- Typed end-to-end (no `any`); ESLint + Prettier; unit tests for all crypto functions (key derivation, wrap/unwrap, encrypt/decrypt round-trips) and integration tests for auth flows.
- Clear separation: `src/crypto` (pure, tested), `src/components`, `src/state`, `server/routes`, `server/middleware`, `prisma/`.
- Seed/demo mode with fake data for local development.
- `README.md`: setup, environment variables, threat-model summary, crypto design explanation, deployment guide.
- Deliver: full source, migrations, test suite, and a short security-design document.

## 8. Acceptance Criteria

- Server database contains **no plaintext or recoverable secrets** — verify by inspecting stored rows.
- Vault unlocks/locks correctly, auto-locks on inactivity, and a page refresh never exposes decrypted data without re-authentication.
- Password generator, strength meter, breach check, and health dashboard all function.
- Import from CSV and encrypted export/import round-trip successfully.
- Both themes render correctly across mobile, tablet, and desktop; Lighthouse Accessibility ≥ 95.
- All crypto unit tests pass; login rate limiting and 2FA work as specified.
