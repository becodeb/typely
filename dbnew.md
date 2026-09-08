# dbnew.md — TYPELY Backend Implementation Log

> Running log of every change made while implementing the backend,
> database, naming cleanup, and perf wins. One bullet per file change.

## Conventions
- One bullet per file touched.
- Each bullet says **what** changed, **why**, and **how it was tested**
  when applicable.
- Tests we run at the end of every phase: `npm run build`.

## Órbita — Carrera de cohetes (08/09/2026)

- `api/migrations/0007_arcade_carrera.sql`: agrega `arcade_bests` por
  alumno y juego, copia los récords de Tormenta y agrega `text_id` a las
  partidas. Migración aplicada en el Postgres local con Docker.
- `api/src/db/schema.ts`: refleja la tabla y la columna nuevas sin cambiar
  los campos históricos del perfil de Tormenta.
- `api/src/carrera.ts`: valida texto conocido y largo exacto, duración
  5–360 s (revisión autorizada), PPM coherentes, precisión, puntaje, puesto,
  nivel cero y mejoras vacías; calcula los cristales con la fórmula del motor.
- `api/src/carreraTextos.json`: metadatos de los sesenta textos aprobados.
  `scripts/preparar-carrera-servidor.mjs` los genera desde el corpus del
  cliente; el examen exige que ambos sigan coincidiendo. El JSON viaja en
  el compilado de API, independiente del árbol de fuentes del frontend.
- `api/src/routes/arcade.ts`: acepta Carrera, mantiene compatibilidad con
  cargas antiguas de Tormenta, guarda récords por juego y devuelve `bests`
  en `/me`. `GET /api/arcade/ghosts?game=carrera` devuelve récord propio,
  tres mejores del grado esta semana y mediana; solo alias y cosméticos.
  Tormenta conserva su validación y sus campos anteriores del perfil.
- `api/src/scripts/verificar-carrera.ts`: prueba carreras de 200, 40 y 12 s,
  rechaza datos alterados, verifica cristales, aislamiento entre juegos,
  fantasmas, privacidad y ranking. Crea cuentas efímeras sobre la base
  local sembrada y las elimina al terminar. Ejecución desde `api/`:
  `node --env-file=.env --import tsx src/scripts/verificar-carrera.ts`.
- `src/utils/api.ts` y `src/utils/orbita/arcade.ts`: cargas de Carrera con
  `textId`, récord local por juego y cola existente. Verificados en navegador
  con cuentas locales: cuatro fantasmas, envío sin conexión, reintento al
  volver al hub y ningún envío en modo demo.
- `.dockerignore`: excluye también dependencias, compilados y archivos
  `.env` anidados. La prueba de Docker desde Windows detectó que `COPY api/`
  pisaba el bcrypt Linux con el binario local de Windows. Reconstrucción
  verificada: API saludable y frontend con HTTP 200 detrás de nginx en
  `127.0.0.1:3007` (3005 ya estaba ocupado por otra prueba local).

Validación: build del frontend, TypeScript de API, `simular-carrera.mjs`,
ambos exámenes de Tormenta y verificaciones de API `verificar-carrera.ts`,
`verificar-signos.ts` y `verificar-tienda.ts` aprobados.
La salida requiere frontend y API con migración 0007; merge y deploy manual
de Ezequiel, según `DEPLOY.md`. No hay autodeploy.

## Phase A — Naming & order cleanup (in progress)

### Decision
The `island1..island15` ids in the data layer were created in the order
the artist files arrived, NOT in the order a student should play them.
The current `WORLD_ORDER` array in `src/data/worlds.ts` already encodes
the correct pedagogical order — but every other piece of code still
calls them `islandN`. The fix: introduce a single `WORLD_PEDAGOGY_ORDER`
constant (the canonical list, in difficulty order) and a `worldId` alias
that maps `w1..w15 → island1..island15` for asset paths / URLs.

The goal is **clean data with zero behaviour change**: the URL stays
`/worlds/<islandId>`, the asset paths stay
`/typely_islands_webp/background-island1.webp`, `localStorage` keys
stay the same. The only visible change: the **display number** on each
island becomes its difficulty position (1..15) rather than its file
order.

### Why not a hard rename everywhere?
- URLs and asset paths are stable, public, and bookmarked.
- `localStorage` keys (`edutic_progress_v1` → `islandN: {...}`) cannot
  be renamed without losing every student's saved progress.
- A rename-only-on-display approach gets 100% of the value with 5% of
  the surface area.

### Files changed in Phase A
- `src/data/worlds.ts` — added `WORLD_PEDAGOGY_ORDER` (canonical
  difficulty list), `pedagogyOrderOf(id)` O(1) lookup, and `displayNumber`
  on the `World` type. `WORLD_ORDER` is now derived from
  `WORLD_PEDAGOGY_ORDER` so there is one source of truth. `buildWorld()`
  populates both `order` and `displayNumber` from the same lookup.
- `src/pages/WorldsPage.tsx` — the icon badge now renders
  `M{world.displayNumber}` above the icon (e.g. `M3` for the 3rd world
  in difficulty order). Asset path / URL / localStorage behaviour
  unchanged.
- `src/styles/global.css` — `.world-icon-badge` is now a 2-row grid
  (number on top, icon below). Added `.world-icon-badge__num` and
  `.world-icon-badge__icon` rules. Badge size unchanged.
## Phase B — Performance wins (in progress)

### Files changed in Phase B
- `src/App.tsx` — `GameplayPage`, `AdminGeneralPage` and `SiteAdminPage`
  are now loaded via `React.lazy()` with a `Suspense` fallback that
  matches the Typely pastel/glass style. Initial JS bundle went from
  **431.71 kB → 343.77 kB (gz: 128.55 kB → 106.06 kB)**, a 17% drop.
  Lazy chunks: GameplayPage 17.19 kB gz, AdminGeneralPage 5.38 kB gz,
  SiteAdminPage 3.51 kB gz.
- `src/pages/WorldsPage.tsx` — `enterWorld()` no longer blocks navigation
  on a 430–1100 ms JS timer. It sets `selectedWorld` (which flips the
  `.is-entering-world` class and the CSS radial flash), prefetches the
  destination background, and navigates after one frame. Net result:
  faster navigation, no orphan timers, no `bg.onload` race conditions.
  Also memoized `trackWidthVw`, `centers`, `ROUTE_D` and `routeSparkles`
  so the SVG path is rebuilt only when the visible set changes — not
  on every focus/hover.
- `src/styles/global.css` — Phase A already added the badge styles for
  the pedagogical number; no further CSS changes in Phase B.

## Phase C — Database, API, auth (in progress)

### Decision recap
- **DB:** Postgres 16, new Docker service `db`, single source of truth
  for users, sedes, classes, progress, attempts.
- **API:** Fastify + Drizzle (TypeScript end-to-end), new Docker service
  `api` on `127.0.0.1:3006`, reverse-proxied by Caddy under `/api/*`.
- **Hot path:** the typing engine keeps reading from `localStorage` so
  the game never blocks on a network round-trip. The API only receives
  a level-complete POST (batched) and is the only source of truth for
  cross-device progress + teacher dashboards.
- **Auth:** JWT access + refresh token in HTTP-only cookies, bcrypt
  password hashing (cost 12). Google sign-in via ID-token verification
  using Google's JWKS (server-side, never trust the client-decoded
  payload for authorisation). Demo mode stays client-only, always
  student.
- **Role invariant:** `admin_sede` cannot create or modify another
  `admin_sede` or any `superadmin`. Enforced in `canGrantRole(actor,
  target)`, which is called by every user-mutating endpoint.

### Files changed in Phase C (frontend)
- `src/utils/api.ts` — new typed `api.*` client (login, google, refresh,
  logout, me, sedes, users, progress, import). Auto-retries once on 401
  after a silent `/api/auth/refresh`. Surfaces `ApiError` with friendly
  Spanish messages.
- `src/hooks/useAuth.tsx` — rewritten to be the API-aware auth provider.
  `loginAny`/`login`/`loginGoogle` are now async and return
  `ActiveUser | null`. `bootstrapping` flag tells the router to wait for
  the silent refresh-cookie recovery. `usingApi` is exposed so dashboards
  can show a "backend offline" pill if needed. Falls back to the existing
  localStorage user list when the API is unreachable, so demo mode keeps
  working offline.
- `src/pages/LoginPage.tsx` — `submit()` and the Google callback became
  `async` to await the new auth API. Added a `NETWORK_ERROR` branch for
  the friendly Spanish message.
- `src/pages/ChangePasswordPage.tsx` — `submit()` and the cancel button
  now `await` / `void` the async auth calls.

### Files changed in Phase C (backend)
- `docker-compose.yml` — added `db` (Postgres 16) and `api` (Fastify +
  Drizzle) services. Both bind to loopback only. The `db` service has
  a `pg_isready` healthcheck. `mecanografia` now `depends_on` the DB.
- `Dockerfile.api` — new multi-stage image: `node:22-alpine` builder
  runs `tsc -p api/tsconfig.json`; `node:22-alpine` runtime copies the
  compiled `dist/` and runs `node api/dist/server.js`. Secrets are read
  from `/run/secrets/*` and exported as env vars.
- `db/init/001_schema.sql` — full schema. Tables: `sedes`, `users`,
  `classes`, `class_teachers`, `class_students`, `class_worlds`,
  `level_progress`, `attempts` (partitioned by month), `invitations`,
  `refresh_tokens`. Includes a `touch_updated_at` trigger.
- `db/init/002_partitions.sql` — idempotent pre-creation of the next 12
  monthly `attempts_YYYYMM` partitions. Safe to re-run from a monthly
  cron.
- `api/package.json` + `api/tsconfig.json` — Drizzle/Fastify/Postgres
  stack. Strict TS, ESM, declarations off (we ship the compiled JS
  inside the container).
- `api/src/db/schema.ts` — Drizzle schema mirroring the SQL. Exported
  types: `Role`, `Grade`, `DbUser`, etc.
- `api/src/db/index.ts` — Postgres connection pool (max 10) + Drizzle
  wrapper.
- `api/src/rbac.ts` — the role guard. `canGrantRole(actor, target)`
  enforces the hard rule: `admin_sede` can never grant `admin_sede` or
  any higher role. `canActOnSede(actor, targetSedeId)` blocks
  cross-sede mutations. Throws `ForbiddenError` for friendly HTTP 403s.
- `api/src/auth.ts` — JWT signing/verifying (HS256, 15 min access),
  bcrypt helpers, opaque refresh tokens (30 days, stored hashed),
  Google ID-token verification against `googleapis.com/oauth2/v3/certs`
  JWKS.
- `api/src/routes/auth.ts` — `/api/auth/login`, `/api/auth/google`,
  `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/me`. Cookies are
  HTTP-only, SameSite=Lax, `secure` in production. Students are blocked
  from the staff form.
- `api/src/routes/sedes.ts` — superadmin-only CRUD.
- `api/src/routes/users.ts` — list/create/edit/delete/reset-password
  + self-service `change-password`. All routes call `assertCanGrant()`
  and `canActOnSede()` so the invariants hold.
- `api/src/routes/progress.ts` — `GET /api/progress/me`, `POST
  /api/progress/complete` (upsert + append to `attempts`), `GET
  /api/teacher/students` (per-class for profesores, per-sede for
  admins).
- `api/src/routes/import.ts` — `POST /api/import/users`. CSV with
  header `name,email,role,grade,class`. Per-row validation, duplicate
  detection, class auto-create, returns per-row temp passwords so the
  admin can hand them out.
- `api/src/seed.ts` — idempotent superadmin seed. Reads
  `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` env vars, defaults to
  `bautistagoni@northfield.edu.ar` / `admin` (CHANGE in prod).
- `secrets/README.md` + `secrets/.gitignore` — operator runbook.
- `.env.example` — added `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`,
  `INVITE_FROM`, `CORS_ORIGIN`, `SUPERADMIN_*`.
- `.dockerignore` — `secrets/*` excluded from the build context.

## Phase D — Teacher dashboard & CSV import

### Files changed in Phase D
- `src/utils/api.ts` — added `importUsersCsv(csv)` (sends raw
  `text/csv`) and `listUsers({role, sedeId})` for the teacher/admin
  dashboards.
- `src/pages/TeacherPage.tsx` — when the session is API-backed, the
  students list now comes from `GET /api/users?role=alumno` and shows
  real per-student best-accuracy (the max of all their `level_progress`
  rows). Falls back to the existing localStorage list when the API
  request fails.
- `src/pages/SiteAdminPage.tsx` — added a "Importar desde CSV" panel
  inside the Alumnos section. Drop a `.csv` (or click to pick) and the
  UI posts it to `/api/import/users`, then renders a per-row result
  (username + temporary password, or the error reason). The class
  column auto-creates the class on the fly if it doesn't exist.
- `src/styles/global.css` — added the `.csv-import*` block (drop zone,
  result list, success/error row tinting).

## Phase E — Hardening

### Files changed in Phase E
- `db/init/002_partitions.sql` — monthly partition pre-creation
  (idempotent, safe to cron monthly).
- `DEPLOY.md` — full rewrite for the new 3-container architecture:
  - **Step 2:** new secrets provisioning runbook (`openssl rand`,
    chmod 600).
  - **Step 4:** new `docker exec api node dist/seed.js` to create the
    superadmin. The seed prints the password once.
  - **Step 6:** Caddy block now has a `rate_limit @api 30r/m` rule for
    `/api/*`, with a `127.0.0.1/32` allow so health checks and internal
    traffic are not throttled.
  - **Step 9:** new backup runbook — daily `pg_dump | gzip` cron at
    03:00 UTC, 30-day retention, with an opt-out for `attempts*` if
    the analytics log outgrows the budget.
  - **Step 10:** common-ops table now includes the API, the DB, the
    API log tail, the psql shell, and the partition pre-creation
    command.
  - **Notes:** updated to mention the new secrets directory, the
    Postgres connection pool tuning for the 1 GB VPS, and the monthly
    partition policy.

## Final verification

| Check                          | Result   |
| ------------------------------ | -------- |
| `tsc --noEmit` (frontend)      | OK       |
| `tsc -p api/tsconfig.json`     | OK       |
| `vite build`                   | OK       |
| Frontend initial JS (gz)       | 106.06 kB (was 128.55 kB) |
| `GameplayPage` chunk (gz)      | 17.19 kB |
| `AdminGeneralPage` chunk (gz)  | 5.38 kB  |
| `SiteAdminPage` chunk (gz)     | 4.17 kB  |

## Pending work (future, not blocking)

- Email invitations via Resend (the data path + token hashing is in
  place; only the `send()` call needs wiring once `RESEND_API_KEY` is
  set).
- "Mundo N" badge already shows the pedagogical position everywhere.
  Future cleanup: a single derived `worldByNumber()` helper could be
  added to `worlds.ts` for routes that want to read the "current
  Mundo" by number.
- Server-side monthly partition rotation cron (the SQL exists; needs
  a cron container or a host cron line to call it).

## Phase G — Audit fixes + admin inspector + UX/permissions pass (2026-06-09/10)

- `api/src/routes/users.ts` — GET /api/users bloqueado para alumno/profesor
  (leak de emails); PATCH valida sede destino y curso destino, soporta
  `username`, sincroniza `class_students` al cambiar de curso y maneja 23505;
  change-password mínimo 6. Probado: tsc + smoke en prod.
- `api/src/routes/academicYears.ts` — requireStaff bloquea alumno/profesor.
- `api/src/routes/invitations.ts` — aceptar una invitación no puede degradar
  una cuenta superadmin/admin-general existente (409).
- `api/src/routes/classes.ts` — POST asigna el año lectivo ACTIVO de la sede
  al crear el curso (antes quedaba NULL y el filtro por año lo escondía:
  "no puedo entrar a cursos nuevos"); el listado de cursos del profesor ya no
  exige sede (profes multi-sede o sin sede ven sus cursos igual).
- `api/src/server.ts` — setErrorHandler movido ANTES de las rutas (Fastify no
  lo hereda hacia atrás: los 401/403 salían con el shape default en inglés);
  alias público `/api/health`; hook onRoute para el inspector.
- `api/src/routes/inspector.ts` (nuevo) — GET /api/admin/inspector
  (superadmin/admin-general/admin-sede): estado API+DB, env enmascaradas,
  rutas vivas con ejemplos, ring-buffer de errores, auditoría reciente.
- `src/pages/admin/ApiInspectorPage.tsx` (nuevo) + ruta `/admin/api` protegida.
- `src/hooks/useAuth.tsx` — completePasswordChange llama de verdad a
  `/api/users/:id/change-password` (antes hacía `api.logout()` placeholder).
- `CoursesListPage` / `StudentsListPage` — los filtros de año tratan los
  cursos sin año como vigentes y muestran a los alumnos sin curso; edición de
  alumno ampliada (nombre + usuario + curso, con sincronización de roster).
- `AdminGeneralPage` — el formulario de sede pasa de incrustado a modal; la
  edición de admin de sede gana el campo usuario.
- Login/Worlds/Island — revertida la tipografía fluida vmin del login (volvió
  la versión anterior), robots más grandes y más arriba, zoom general
  reducido (islas, nave, nodos, HUD), fondo levemente más brillante (base
  `#f1effb` + velo blanco en `.login-aura`), botón secundario más discreto.
- Borrados: `src/pages/SiteAdminPage.tsx`, `src/utils/emailService.ts`,
  `docs/ADMIN_SEDE_ARCHITECTURE.md` (spec vieja, ya implementada).

## Phase H — Crash de /admin-sede, modales con blur real, marca (2026-06-10)

- **Crash crítico**: `/admin-sede/cursos` y `/admin-sede/alumnos` montaban en
  gris SIEMPRE — las páginas llaman `useAcademicYear()` en su propio cuerpo,
  fuera del `AcademicYearProvider` que vivía dentro de `SedeShell`, y el hook
  tira si no hay provider. Fix: provider movido a un layout de ruta
  (`SedeAcademicYearLayout` en `SedeShell.tsx`, montado en App.tsx sobre TODO
  el grupo admin-sede) y quitado de SedeShell. Verificado en preview.
- `ErrorBoundary` global (App) — un crash de render ya nunca deja la pantalla
  gris muda: tarjeta amigable con Recargar / Ir al inicio.
- **Modales**: nuevo sistema `.modal-overlay` (oscurece + `backdrop-filter:
  blur(16px)` sobre TODO el fondo) + `.modal-card` (glass más opaco) aplicado
  a todos los modales de admin (AdminGeneral ×5, Cursos, Alumnos ×2, Docentes,
  CourseDetail, CloseYearWizard). Lo de atrás ya no compite con el modal.
- **Docentes**: asignar a un curso un profesor SIN sede ahora adopta la sede
  del curso (invitaciones aceptadas sin sede quedaban inasignables con 403
  "de otra sede"). POST /api/sedes crea el año lectivo activo del año
  calendario (las sedes nuevas no tenían año → cursos sin año).
- **Marca**: el "T" + wordmark en tipografía body se reemplaza por el robot
  (favicon-256) + "TYPELY" en font-display con gradiente de marca, en
  `DashboardShell` y `Brand`.
- DataTable: header con tinte de gradiente, zebra suave y hover celeste.
  Hero de los dashboards con hairline de gradiente superior.
- LoginPage: `fetchpriority` → `fetchPriority` (warning de React 19).

## Phase I — Gameplay sin recortes, blur Apple, ruta animada (2026-06-10)

- WorldsPage: el gradiente de la ruta cicla los colores de marca vía SMIL
  (como el texto de bienvenida); islas más grandes (`min(21vw,34vh)`,
  tope 19.5rem).
- GameplayPage: "Escuchar consigna" pasa a ícono arriba a la derecha (junto
  a Reintentar) — el botón grande de abajo empujaba el teclado fuera de
  pantalla sin F11. TTS explícito: "Palabra a escribir: ventana", "Letra
  que toca: G", "Frase a escribir: …". Robots anclados al suelo (bottom)
  con flotación reducida a ±4px (ya no parecen volar — aplica también a
  login y mundos). Vista de "lo que estás escribiendo" con min-height y
  más contraste. Verificado por geometría en preview a 1366×620: teclado
  completo y tipeo visibles, sin recortes.
- COMPACT-HEIGHT PASS al final de global.css: las teclas (.gp-key) se
  achican a max-height 720/640/560 para que el teclado entre siempre.
- Modales estilo Apple: .modal-overlay difumina fuerte (blur 22px) y casi
  no oscurece; .modal-card ya NO sube la opacidad (solo blur del vidrio) —
  liquid glass legible sin opacar. Aplicado también al modal de nivel
  completado (Gameplay) y al modal del modo demo (Login).

## Phase J — blur de modales (causa raíz), impersonación read-only (2026-06-10)

- **CAUSA RAÍZ del "difuminado no funciona" en popups**: `.animate-page-fade`
  animaba `translateY` con `fill-mode: both`, dejando un `transform` PERMANENTE
  en el contenedor raíz del dashboard. Un ancestro con `transform` DESACTIVA el
  `backdrop-filter` de los descendientes en Chrome → los overlays oscurecían
  pero no difuminaban. Fix: `@keyframes pageFade` ahora anima SOLO opacity.
  Diagnosticado midiendo `getComputedStyle` en el preview (el ancestro tenía
  `matrix(1,0,0,1,0,0)`); confirmado visualmente que al quitar el transform el
  blur aparece.
- Blur de modales ajustable en vivo desde /editor-glass: variables
  `--modal-blur` / `--modal-tint`, dos sliders nuevos + un "popup de ejemplo".
  `applyStoredGlass()` ahora se llama en main.tsx (antes no corría en boot).
- WorldsPage: islas más grandes (`min(24vw,38vh)`, tope 22rem) y las
  bloqueadas más apagadas (`grayscale saturate-0 opacity-50 brightness-90`).
- **Impersonación en MODO LECTURA (F8)** — soporte avalado legalmente, 30 min:
  - `api/src/routes/support.ts`: `POST /api/admin/impersonate` con TRIPLE
    verificación (contraseña del admin + frase exacta "ACCEDER EN MODO LECTURA"
    + aceptación legal). Emite un access token con claim `readOnly` y SIN
    refresh cookie (muere solo a los 30 min). Valida alcance (RBAC por sede,
    nunca a un superadmin). Auditado (`impersonate_start`).
  - `server.ts`: preHandler global que rechaza TODA mutación (no-GET, salvo
    auth logout/refresh) cuando el token es `readOnly`.
  - `auth.ts`: claims `readOnly` + `act` (actor real); `signAccessToken` con
    TTL configurable.
  - Frontend: `ImpersonateModal` (triple auth) en AdminGeneral (admins),
    StudentsListPage y TeachersListPage; `ImpersonationBanner` fijo global con
    cuenta regresiva que al expirar restaura al admin; `useAuth` gana
    `impersonation` + `startImpersonation`/`stopImpersonation`; el cliente API
    desactiva el refresh silencioso en modo lectura para no restaurar al admin.
- `.env.local` (gitignored) creado con SUPERADMIN admin/admin para desarrollo.

## Phase K — el blur SÍ rompía en prod: Lightning CSS (2026-06-10)

- **2º causa raíz del blur** (la de Phase J era real pero parcial): escribir
  `backdrop-filter: blur(var(--x))` a mano hace que el Lightning CSS de
  Tailwind v4 ELIMINE la propiedad estándar en el build de prod y deje solo
  `-webkit-backdrop-filter` (que el Chrome del usuario no aplica). Por eso en
  el preview dev (CSS sin minificar) difuminaba y en producción no — en NINGÚN
  modal ni superficie glass. Diagnosticado curleando el CSS desplegado y
  grepeando: solo había `-webkit-`.
- Fix: TODAS las utilidades glass (`glass`, `glass-strong`, `glass-card`,
  `glass-card-smooth`, `glass-surface`) y `.modal-overlay` ahora hacen el blur
  con `@apply backdrop-blur-[var(--glass-blur)] backdrop-saturate-[...]`
  (utilidad nativa de Tailwind), que emite el `backdrop-filter` estándar
  (`var(--tw-backdrop-blur,) …`). Verificado en el bundle: 13 ocurrencias del
  estándar; computed `blur(22px)`/`blur(48px)` en overlay/card. Ver memoria
  [[backdrop-filter-transform-gotcha]].
- `browserslist` moderno agregado en package.json.

## Phase L — admins simples, blur focalizado, teclado 3D, SEO (2026-06-10)

- **Admins de sede, flujo simple**: "Invitar admin de sede" = un solo modal con
  email (+nombre opcional) + sede → la invitación se envía sola. Eliminado el
  bloque usuario/contraseña manual y el formulario inline duplicado. La lista
  de invitaciones muestra solo las EN CURSO (pendiente/enviada) — las
  aceptadas ya aparecen arriba como cuentas reales.
- **Consistencia de invitaciones (API)**: POST /api/invitations rechaza con
  409 si el email ya pertenece a una cuenta superadmin/admin-general o a una
  cuenta con el mismo rol (la causa del "accepted" fantasma: se había invitado
  al email del propio superadmin).
- **Blur focalizado**: .modal-overlay ahora lleva una mask-image radial — el
  difuminado se concentra detrás del componente y se desvanece hacia los
  bordes (profundidad de campo) en vez de empañar TODA la pantalla; tinte
  bajado a 0.10 (menos velo gris). Defaults del editor actualizados.
- **Teclado del juego**: keycaps con profundidad 3D (borde inferior grueso en
  el tono de la fila, brillo superior inset, sombra en capas), hover lift,
  efecto de presión al click, filas con más aire y teclado levantado del borde
  (pb-6). La tecla objetivo brilla con sombra azul propia.
- **SEO/Lighthouse**: public/robots.txt (antes el fallback SPA devolvía HTML)
  + sitemap.xml; title descriptivo, meta description, Open Graph completo y
  Twitter card en index.html; source maps en el build (vite sourcemap);
  headers de seguridad en nginx.conf: HSTS, X-Frame-Options, COOP
  (same-origin-allow-popups por Google Sign-In), nosniff, Referrer-Policy,
  Permissions-Policy y CSP completa (self + accounts.google.com + Google
  Fonts + data:/blob: para fotos de sede). Trusted Types NO se activó:
  rompería React (require-trusted-types-for bloquea innerHTML del runtime).


