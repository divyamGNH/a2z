# Setup and deployment

## Project layout

The root is an npm workspace for convenient local commands. `frontend/` and `backend/` are independently deployable: each has its own package file, lockfile and environment example. Neither deployed application imports code from the other directory.

- `frontend/app/page.tsx`: sheet UI and login-first access gate.
- `frontend/app/login/page.tsx`: combined login/signup page.
- `frontend/components/account-panel.tsx`: email and GitHub login forms.
- `frontend/lib/account-progress.ts`: account saving, pending changes and cross-device refresh.
- `frontend/data/sheet.json`: normalized 455-entry sheet.
- `backend/index.mjs`: Node service entry point.
- `backend/app.mjs`: authentication, authenticated progress API and Postgres access.
- `backend/data/question-ids.json`: server-side allowlist, generated alongside the sheet.

## Environment files

Copy `frontend/.env.example` to `frontend/.env` and `backend/.env.example` to `backend/.env`. Both credential files are ignored by Git.

The frontend has just one public setting:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Configure backend values using `backend/.env.example`:

- `DATABASE_URL`: Supabase Postgres session-pooler connection; URL-encode its password.
- `DATABASE_CA_FILE=certs/supabase-ca.crt`: included public Supabase CA. Certificate verification stays enabled.
- `BETTER_AUTH_SECRET`: strong stable server secret; keep it unchanged across deployments.
- `FRONTEND_URL`: exact frontend origin, without a trailing slash.
- `BETTER_AUTH_URL`: public API origin, without a trailing slash.
- `API_HOST` / `API_PORT`: local listening settings. Hosted `PORT` takes priority.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: optional GitHub OAuth credentials.
- SMTP settings and `MAIL_FROM`: email delivery for verification and recovery.

Generate an auth secret locally:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Production requires a strong auth secret, HTTPS frontend/API origins and SMTP configuration. Local email/password login works without SMTP; recovery reports that email is unavailable. Supabase is only the database host, with no Supabase Auth dependency.

## GitHub OAuth

Register an OAuth App at https://github.com/settings/applications/new.

| Setting | Local value |
| --- | --- |
| Homepage | `http://localhost:3000` |
| Authorization callback | `http://localhost:4000/api/auth/callback/github` |

Use a separate production OAuth App with your deployed frontend homepage and `https://YOUR_API_DOMAIN/api/auth/callback/github` callback. Leave wildcard matching and device flow disabled. The provider requests only profile and email scopes, with no repository access. Credentials belong only on the backend.

## Frontend hosting

For Vercel, import the repository and set Root Directory to `frontend`. Select **Other** as the framework preset, install with `npm ci --workspaces=false`, build with `npm run build`, and publish `out`. The checked-in `frontend/vercel.json` sets these static-hosting options and clean URLs for routes such as `/login`. Set `NEXT_PUBLIC_API_URL` before building; changing it requires rebuilding.

Do not combine the Next.js framework preset with a manual `out` output override. That combination can make Vercel look for Next.js server manifests inside the static export, producing a missing `out/routes-manifest.json` error. The app still uses Next.js to build; Vercel serves its exported HTML/CSS/JavaScript without a Next.js backend.

The frontend is a static export. Next.js has no API routes or server actions.

## Backend hosting

For Render, create a Node Web Service with Root Directory `backend`:

- Build/install: `npm ci --workspaces=false`.
- Start: `npm start`.
- Health check: `/api/health`.
- Node: version 24.13 or later.
- `NODE_ENV=production`.
- `API_HOST=0.0.0.0`.
- Let the host supply `PORT`, or configure `API_PORT`.

Put backend environment values in the host's secret/environment dashboard rather than uploading a credential file. `certs/supabase-ca.crt` is part of the backend directory. The API creates its isolated `a2z_sheet` schema and migrates its tables. It does not use Supabase's built-in auth schema.

Use same-site frontend/API domains such as `sheet.example.com` and `api.example.com` with the current cookie configuration. For unrelated default hosting domains, configure a same-origin API proxy first. The API currently assumes one trusted reverse proxy in production.

## Saving behavior

Signed-in progress is stored in Postgres. Clearing cookies signs you out, but logging back in restores server-confirmed progress. Pending changes are cached per account in the browser and retried; clearing browser storage before they sync can still lose those unsaved changes.

The UI refreshes other-device progress every 15 seconds and when focused. Per-field updates avoid overwriting unrelated edits; the last accepted write wins if two devices change the same field. Existing guest progress can be explicitly merged into an account. Guest access is an explicit choice lasting for that tab session.

## Development checks

Run these from the repository root:

```bash
npm test
npm run typecheck
npm run build
npm run check:client
npm run test:api
```

`test:api` creates and deletes only a unique disposable `a2z_test_*` schema in the configured Postgres database. The tests cover account isolation, authentication, persistence, input/origin validation, account switching and GitHub OAuth initiation. Actual GitHub consent and SMTP delivery still need a live check with your configured providers.

`check:client` scans source and browser output for configured secret values and checks frontend environment references, imports, ignore rules and tracked credential filenames. It does not certify external hosting logs or all historical commits.

To regenerate sheet data and the backend allowlist, run `npm run data:build` from the root. Provenance and known link issues are retained in `research/`.
