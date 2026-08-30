# TYPELY (formerly EduTic)

TYPELY is a gamified Primary School digital-literacy and keyboard-skills
platform. Frontend: **Vite + React 19 + TypeScript + Tailwind 4**. It is backed
by a **Fastify + Drizzle + Postgres 16 API** and ships as three Docker
containers (Nginx frontend, API, Postgres) behind a reverse proxy. The typing engine keeps
reading/writing `localStorage` so play never blocks on the network, and falls
back to localStorage-only when the API is offline (demo mode).

> **Authoritative doc:** `CLAUDE.md` — architecture, design and responsive
> systems, asset layout, curriculum, deployment, branching and the working rules
> for agents. It is the single source of truth; `AGENTS.md` and
> `.cursor/rules/project.mdc` are stubs that point at it. Two companion docs
> carry their own content: `dbnew.md` (backend log) and `DEPLOY.md` (ops).

## Branching workflow

Two long-lived branches. **`dev`** is where the work happens. **`production`**
is what is deployed, and only receives changes that already build, run and are
ready to go live — through a pull request from `dev`. Never commit to
`production` directly. See `CLAUDE.md` §17 for the full rules. Deploys are
**manual**, through Coolify — merging into `production` publishes nothing by
itself.

```bash
git checkout dev && git pull
# …work, commit, push to dev…
# when it is genuinely ready to ship:
gh pr create --base production --head dev && gh pr merge --merge
```

## Roles & dashboards

After login each role lands on its own experience (see `routeForRole`):

| Role | Lands on | Experience |
| --- | --- | --- |
| `superadmin` | `/admin-general` | **Global control center** — create/edit sedes, create sede admins, ecosystem counters. |
| `admin-sede` | `/admin-sede` | **Sede dashboard** — courses, teachers, students, invitations, progress (scoped to one sede). |
| `profesor` | `/profesor` | Teacher panel — assigned class, students, island enablement. |
| `alumno` | `/mundos` | The gamified world map (islands/levels). |

The student game map is **exclusive to students**: the `/mundos` route group is
marked `exclusive`, so an admin/teacher who tries to open it is redirected to
their own dashboard.

**Superadmin login (always works):** username `admin`, password `admin`. A
defensive fallback in `authenticateAny` restores the seeded `SUPERADMIN_USER`
even if persisted localStorage is stale/corrupt.

### Email invitations (teachers)

A sede admin can invite a teacher by email (Invitaciones tab). This creates an
`Invitation` record with a token + `pending` status and a shareable link. The
frontend calls an **internal backend endpoint** (`/api/invitations/send`,
configurable via `VITE_INVITE_API_URL`) — it never talks to the email provider
directly and holds no API key. If the backend isn't deployed, the invitation
stays `pending` and the UI offers a copyable invite link.

To enable real delivery, run the optional server scaffold (`server/index.mjs`):

```bash
npm i express resend
RESEND_API_KEY=re_xxx INVITE_FROM="Typely <no-reply@typely.bauhub.online>" node server/index.mjs
```

> **Security:** `RESEND_API_KEY` lives ONLY in the server environment. Never put
> it in a `VITE_` variable — those are inlined into the public browser bundle.

## Install

```bash
npm install
```

## Local setup — environment variables

The app reads its config from a local `.env` file (loaded by Vite). The file
is gitignored — never commit it.

1. Copy the example:
   ```bash
   cp .env.example .env
   ```
2. Fill in your Google Identity Services Client ID:
   ```env
   VITE_GOOGLE_CLIENT_ID=404366112555-2rsl9af3vqdr5pv62m09r434vl7qdmor.apps.googleusercontent.com
   # Optional — comma-separated institutional domains. Empty = allow any.
   VITE_GOOGLE_ALLOWED_DOMAINS=
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```

If `VITE_GOOGLE_CLIENT_ID` is missing, the "Login with Google" button shows
*"Google Login no está configurado."* and does nothing.

> **Security:** never put `GOOGLE_CLIENT_SECRET` (or any private key) in this
> repo or in a `VITE_…` variable — Vite inlines those into the public browser
> bundle. Backend secrets (`JWT_SECRET`, `RESEND_API_KEY`, OAuth client secret)
> live only in the API's server-side environment / `secrets/` — never in the
> frontend. Google sign-in is verified server-side against Google's JWKS.

## Google Cloud setup

In **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0
Client IDs**, edit the Web application client and add:

**Authorized JavaScript origins:**
- `http://localhost:5173`
- `https://typely.bauhub.online`

**Authorized redirect URIs** (only needed if you ever add a server-side
code-exchange callback — not used by the current frontend-only flow):
- `http://localhost:5173/auth/google/callback`
- `https://typely.bauhub.online/auth/google/callback`

After login, the email returned by Google is matched against the local user
store. Unknown emails are rejected with *"Tu cuenta todavía no está
habilitada en Typely."* — unknown Google accounts never receive admin
privileges automatically.

> If you change the seed data (e.g. add an email to a user), wipe demo
> storage so the change is picked up — see **Reset Demo Data** below.

## Production / Docker

Vite inlines `VITE_…` variables at **build** time, so the production Docker
build must receive them as build args. `Dockerfile` and `docker-compose.yml`
already declare the args. Either export them in your shell and run compose:

```bash
export VITE_GOOGLE_CLIENT_ID=404366112555-2rsl9af3vqdr5pv62m09r434vl7qdmor.apps.googleusercontent.com
export VITE_GOOGLE_ALLOWED_DOMAINS=northfield.edu.ar,reditinere.com
docker compose up -d --build
```

…or pass them inline:

```bash
VITE_GOOGLE_CLIENT_ID=… docker compose up -d --build
```

…or place a `.env` file next to `docker-compose.yml` on the host (compose
reads it automatically). The file is gitignored.

## Run

```bash
npm run dev
```

## Demo Credentials

| Role | Username | Password | Route |
| --- | --- | --- | --- |
| Admin general | `admin` | `admin123` | `/admin-general` |
| Admin de sede | `sede` | `sede123` | `/admin-sede` |
| Profesor | `profe` | `profe123` | `/profesor` |
| Alumno | `sofia` | `alumno123` | `/mundos` |

The login page also has an "Entrar en modo demo" button for the selected role.

## Routes

- `/` and `/login`: login
- `/mundos`: student world selection
- `/worlds/island1` through `/worlds/island4`: island detail pages
- `/gameplay/encuentro-letras`: playable assisted letter activity
- `/gameplay/letra-rapida`: playable speed letter activity
- `/gameplay/tecla-correcta`: playable key accuracy activity
- `/gameplay/encuentro-palabras`: playable word typing activity
- `/gameplay/espacio-magico`: playable spacebar activity
- `/gameplay/borro-y-corrijo`: playable correction activity
- `/logros`: student rewards
- `/mi-cuenta`: student account
- `/admin-general`: general administration
- `/admin-sede`: site administration
- `/profesor`: teacher panel

## Assets

Original image files are stored in:

```text
Images/
```

Required app copies are stored in:

```text
public/assets/edutic-art/
```

Transparent world-selection island copies are stored in:

```text
public/assets/processed/
```

Do not modify, overwrite, crop, compress, recolor, or rename the original files inside `Images/`. Any processed versions must be copies in a separate folder such as `public/assets/processed/`.

## Reset Demo Data

Open the browser console and run:

```js
localStorage.removeItem("edutic_active_user");
localStorage.removeItem("edutic_demo_data");
localStorage.removeItem("edutic_sites");
localStorage.removeItem("edutic_classes");
localStorage.removeItem("edutic_users");
localStorage.removeItem("edutic_access_codes");
localStorage.removeItem("edutic_activities");
localStorage.removeItem("edutic_assignments");
localStorage.removeItem("edutic_attempts");
localStorage.removeItem("edutic_rewards");
location.reload();
```
