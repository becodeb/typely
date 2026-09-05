# CLAUDE.md

> **This file is the single source of truth.** Architecture, design system,
> rules and workflow all live here — there is no second rulebook. Every other
> agent entry point (`AGENTS.md`, `.cursor/rules/project.mdc`) is a stub that
> points back to this file, so Claude Code, Codex, Cursor and OpenCode all read
> the same rules. A handful of companion docs carry content of their own, and
> each has a distinct job: `DEPLOY.md` (ops runbook), `dbnew.md` (backend
> implementation log) and the three art recipes under `Images/islands/` —
> `ISLAS.md` (splitting a scene), `BOTONES.md` (a world's level button) and
> `FONDOS.md` (a world's gameplay background). If any of them ever disagrees
> with this file, **this file wins** — fix the other one.

## 1. Project Overview

**TYPELY** (previously codenamed *EduTic*) is a gamified typing and digital
literacy learning app for primary school students. Spanish-first
(Latin-American Spanish), keyboard-driven, real activities — no placeholder
gameplay. Students learn to locate keys, type letters/words, use the spacebar,
Shift, Backspace, tildes and the ñ, and progress through a chain of magical
floating islands of increasing difficulty.

Core visual direction:

- Magical floating islands in a dreamy pastel sky.
- Premium, kid-friendly educational product — playful but never childish.
- Soft 3D fantasy game feeling — bright art, soft shadows.
- Clean glassmorphism UI: translucent cards over the immersive art.
- Minimal interfaces that keep the artwork visible at all times.

## 2. Brand & Naming

- **Product name:** TYPELY (uppercase wordmark).
- Internal identifiers like `EduTicUser`, the localStorage prefix `edutic_*`,
  the world ids `island1..island15`, and the npm `name: "edutic"` are kept for
  backward compatibility — only **user-facing strings** read "TYPELY". URLs,
  asset paths and localStorage keys are stable and must not be renamed.

## 3. Architecture (current)

TYPELY nació solo-frontend (localStorage) y hoy tiene backend real. Corre como
**dos contenedores detrás del proxy de Coolify**, más un Postgres administrado
por Coolify, en `typely.becode.com.ar`.

| Capa | Stack | Dónde |
| --- | --- | --- |
| Frontend | Vite 7 + **React 19** + TypeScript + **Tailwind 4**, compilado a estáticos que sirve Nginx | `src/`, `Dockerfile`, `nginx.conf` |
| API | **Fastify + Drizzle ORM** (TS, ESM) | `api/`, `Dockerfile.api` |
| Base | **Postgres 16**, recurso de Coolify | `api/migrations/*.sql` |

- **Un solo dominio.** Nginx sirve el frontend y **proxea `/api/*`** al
  contenedor de la API por la red interna. El proxy de Coolify (Traefik)
  enruta por dominio, no por path, así que un dominio no puede alcanzar dos
  contenedores por sí solo — ese bloque en `nginx.conf` es lo que lo resuelve.
- **El camino caliente sigue local.** El motor de tipeo lee y escribe
  `localStorage` para no esperar nunca a la red. La API recibe los niveles
  completados por una **cola con reintento** y es la fuente de verdad para el
  progreso entre dispositivos.
- **No hay fallback a localStorage.** Si la API no responde, se dice que no
  responde. La versión anterior autenticaba contra una lista de usuarios del
  navegador, lo que permitía entrar al panel con la API caída.
- **Migraciones versionadas** en `api/migrations/`, aplicadas por
  `api/src/db/migrate.ts` al arrancar, bajo advisory lock. Si una falla, la
  API **no levanta**: servir contra un esquema a medias es peor que no servir.

## 4. Roles & Auth

Cuatro roles: `superadmin` (la plataforma), `admin` (UNA sede), `docente`
(sus grupos), `alumno` (él mismo).

- **Un solo login para los cuatro.** `POST /api/auth/login` recibe
  `identifier` —usuario **o** email, el mismo campo del formulario— y la
  contraseña. El código anterior devolvía 403 si el rol era `alumno`, en el
  login: un alumno no podía entrar de ninguna forma,
  y esa era la causa raíz de que los dashboards estuvieran siempre vacíos.
- **`username` es la identidad primaria** y la tienen todos. El **email es
  opcional**: un alumno de primaria no tiene, y el admin le entrega usuario y
  contraseña temporal impresos (`GET /api/groups/:id/credentials-sheet`).
- **No hay login social.** Se sacó el inicio con Google a propósito: en una
  escuela las cuentas las reparte un administrador, y no se quiere que
  cualquiera con un correo entre solo. Si alguna vez vuelve, se implementa de
  cero — no quedó nada a medias esperándolo.
- **Contraseñas temporales:** se crean con `must_change_password` y
  `ProtectedRoute` fuerza `/cambiar-contrasena`. Cambiar la propia exige la
  actual, **salvo** en ese cambio forzado (quien llega ahí acaba de
  autenticarse con la temporal). Nunca se muestra ni se guarda una contraseña
  en claro: solo el valor temporal, una vez.
- **RBAC** (`api/src/rbac.ts`): matriz explícita de permisos por rol y de qué
  roles puede otorgar cada uno. **Un `admin` nunca puede crear otro `admin`.**
  No es un ranking numérico — eso no puede expresar esa regla.
- **Un solo chokepoint:** `api/src/authContext.ts` verifica el token una vez
  en un hook global y lo deja en `req.actor`. Las rutas piden permisos con
  `requirePermission()`. Antes había ocho copias de `requireUser`.
- **Desactivar, borrar o resetear revoca los refresh tokens.** Sin eso la
  sesión seguía viva hasta 30 días y la desactivación no tenía efecto real.
- **El modo demo es solo del alumno**, local, sin cuenta ni token, y nunca
  manda datos a la API. Es una partida de muestra, no una sesión.
- **El primer superadmin se crea a mano** con `npm run bootstrap` en el
  contenedor de la API. Ya no existe ningún `admin`/`admin` en el bundle.

## 5. Visual Design System

### Typography
- Loaded from Google Fonts in `index.html`:
  - **Baloo 2** (500/600/700/800) — display: headings, key labels, buttons,
    wordmark, the big target letter.
  - **Poppins** (400–800) — body, inputs, paragraphs.
- CSS variables in `src/styles/global.css`:
  `--font-display: "Baloo 2", "Fredoka", …` and
  `--font-body: "Poppins", "Nunito", …`.
- Fredoka and Nunito survive only as **fallbacks** in those stacks. This file
  used to name them as the pair, which was wrong — always read the shipped
  `index.html` link and the two CSS variables, not a remembered pair.

### Color palette
- Sky blue `#9fc8ff` `#cfeeff`; deep navy `#17355f` `#153b78`; turquoise/mint
  `#22c7b8` `#54e8c6` `#5be8ba`; electric blue/violet `#536bff` `#3159e8`
  `#7c71ff` `#9b7cff` `#5932d4`; soft pink `#ff9fca`; gold `#facc15` `#ffd552`;
  glass white `rgba(255,255,255,0.55→0.92)`.

### Gradients / radius / shadows / animation
- Primary action gradient: `linear-gradient(135deg, #54e8c6, #25c8df, #536bff)`.
- Magical/completion: `linear-gradient(145deg, #5be8ba, #607bff, #ff9fca)`.
- Radius: small 14–18px, pills/buttons 18–24px, glass cards 24–36px, circle 999px.
- Shadows are soft and colorful, never harsh black. Glass panels:
  `0 24px 60px rgba(54,86,134,0.2)`.
- Animations are soft and purposeful; honour `prefers-reduced-motion: reduce`.

### Login card — reference spec

Target proportions for the login card, kept from the original design reference.
Where a number here disagrees with what `LoginPage.tsx` actually ships, **the
shipped value wins** — notably the card is fixed at `w-[min(32rem,92vw)]`, and
the fonts are the shipped pair (see "Typography" above); do not introduce
Quicksand, which the original reference also suggested.

- **Card:** radius 34–44px, background `rgba(255,255,255,0.58)`, backdrop blur
  22–30px, 1px border `rgba(255,255,255,0.85)`, outer shadow
  `0 30px 90px rgba(80,70,180,0.28)`, soft turquoise/purple/pink glow on the top
  and right edges. Never a flat blue/white rectangle.
- **Vertical order:** wordmark → title → subtitle → "Tu rol" divider → 2×2 role
  selector → user input → password input → primary button → demo button → safety
  note.
- **Wordmark** dominates the top of the card at 48–58px. Never a small square
  icon as the brand.
- **Type:** title 40–48px weight 800–900 `#18325f`; subtitle 17–20px `#52658f`;
  labels 14–16px weight 700 `#596994`.
- **Role selector:** 2×2 pills, gap 14–16px, height 62–68px, radius 18–22px.
  Inactive `rgba(255,255,255,0.72)`; active
  `linear-gradient(135deg, rgba(255,255,255,0.9), rgba(220,245,255,0.65))` with a
  2px `#5ff3d4`/`#9b7cff` border and `0 0 22px rgba(118,92,255,0.25)` glow.
- **Inputs:** height 58–64px, radius 18–22px, `rgba(255,255,255,0.72)`, border
  `rgba(130,140,190,0.22)`, focus border `#73f3dc` with
  `0 0 0 4px rgba(115,243,220,0.25)`. Left icon; eye toggle on password.
- **Primary button:** height 62–68px, radius 22px,
  `linear-gradient(90deg, #54e8c6, #25c8df, #536bff)`, shadow
  `0 14px 30px rgba(35,190,210,0.35)`, sparkle left + arrow right, hover
  `translateY(-2px) brightness(1.03)`, active `scale(0.98)`.
- **Demo button:** height 56–62px, `rgba(255,255,255,0.78)`, text `#405083` or
  `#5e4edb`, rocket icon, soft border.
- **Mascots** flank the card from outside it, never cropped, never stretched,
  never on a white box. See "Login mascots" below for the shipped positioning.

When you change this screen, screenshot it and compare against the reference
before calling it done; fix spacing, proportions, blur, radius and shadows and
repeat. One pass is rarely enough.

### Keyboard (GameplayPage)
- Five rows (`num`, `top`, `home`, `bot`, `mod`). Keys are frosted crystal
  keycaps; **only the bottom edge carries the row colour**, which is what lets
  a kid find the home row without reading. Assisted mode lights the
  `expectedKey` derived in `keyCapFor()` as a glowing crystal.
- **It is not clickable, and that is the point** — see §6.5.

Full design language for the level screen (keyboard, target, mission, and the
clickable-vs-inert rule) lives in **§6.5**.

## 6. Responsive System

> **Primary target device: touch Chromebooks** (Acer and similar) — small but
> rectangular screens. Many of them are **3:2**, not 16:9 (1366×912, 2256×1504),
> which matters because all the island art is 16:9. Phones are **explore-only**
> — browsable, no level playable (§6.2). Optimise for the Chromebook first.

`src/styles/global.css` holds the visual system + all page CSS. Responsiveness
targets three device classes:

- **Common monitors (≥1280px):** the default desktop layout.
- **Small laptops / Chromebooks (1280–1366 wide but SHORT, ~768/800 tall):** the
  real constraint is *height* — handled by the existing `@media (max-height: …)`
  blocks (720/620/560). Width layout = desktop.
- **Phones (≤768px):** **explore-only** — the whole game is browsable, no level
  is playable. The full decision, and what it means screen by screen, is §6.2.
  **This class is handled in React, not in CSS.** `global.css` still has no
  phone block, and that is on purpose: what a phone changes is *behaviour*
  (which route is reachable, where the zoom lens sits, how many islands the
  track fits) and none of that is expressible as a width override. The single
  source of truth is the `useEsCelular` hook — see §6.2. If a future change is
  purely cosmetic and CSS *can* express it, it goes at the END of `global.css`,
  width-only, so it wins the cascade without disturbing the scattered
  `max-height` overrides that the Chromebooks depend on.

### 6.1 Island stage — the level-map coordinate system

The island map has ONE coordinate system, and everything on it is measured as a
percentage of that system. Never `vmin`, never pixels.

- `.island-stage` (in `global.css`) is a box with the art's own aspect ratio,
  centred and **contained** — the art always fits entirely, so a level node can
  never end up off-screen. `IslandDetailPage` only supplies the ratio through
  `--art-ar`; the box itself is pure CSS, with no measuring and no `resize`
  listener.
- Behind it, `.island-backdrop` covers the viewport and may crop freely: it
  fills the bands that `contain` leaves over. `island1` uses the real pastel sky;
  every other world reuses its own art, scaled and blurred
  (`.island-backdrop--blur`). That blur disappears once the art ships in layers.
- Level nodes size themselves as a **% of the stage** (`clamp(2.75rem,5.34%,14rem)`
  + `aspect-square`), and the number inside uses `cqw` against the node. The
  `5.34%` and `24.21cqw` reproduce the original `9.5vmin` / `2.3vmin` at
  1920×1080 — that is the reference resolution for every conversion here.
- Node positions live ONLY in `src/data/levelPositions.ts`, as percentages of
  the art. **Never** freeze a position as CSS: a rule like
  `#btnisland6lvl1 { transform: translate(15px,-35px) }` is valid at exactly one
  screen size and drifts at every other. The `LevelPositionEditor` copies a data
  array — use that. Do not use `DevLayoutEditor`'s "Generar CSS" on level nodes.

Measured after the switch to `contain` (2026-08-24): the node/stage ratio stays
at 5.34 % from 375×812 to 3440×1440, and no node falls off-screen anywhere. On
3:2 Chromebooks the old `cover` box was cropping **16 % of the image**.

**The platform discs stay painted into the art** — that is a deliberate art
decision. So placing a level is still a visual judgement: the node has to land
on a disc someone drew. What `contain` buys is that once it is right, it stays
right at every resolution.

**Placing levels — the visual editor.** This is the intended workflow; it saves
straight to `src/data/levelPositions.ts`, no copy-paste.

1. Enable it once per browser (it persists):
   `localStorage.setItem("typely_dev_editor","1")`
2. Open `/worlds/island2?editor=1` on the dev server.
3. Drag a node — the whole block moves (base, blue presser, number, glow).
   Arrow keys nudge it; `Shift` makes the step coarse (x10) and `Alt` makes it
   fine (position 0.1 %, rotations 0.5°, scale 0.01). The handler calls
   `preventDefault` on every arrow **before** checking whether a node is
   selected, because `Alt + ←` is the browser's Back and would otherwise leave
   the page mid-adjustment.
4. `S` `X` `Y` `Z` `P` toggle scale / rotateX / rotateY / rotateZ / perspective;
   arrows then adjust the active one. `Esc` deselects.
5. `N` and `M` do the same for the **number** drawn on top of the button: `N`
   moves it (all four arrows), `M` resizes it. See below for why it needs its
   own controls. The **"Ver apretado"** toggle switches the selected node to its
   pressed art, and while it is on `N` and the sliders write the *pressed*
   number position instead of the resting one.
6. Zoom with the wheel (anchored at the cursor), `+` / `-`, or the panel
   buttons; pan with `Space` + drag or the middle mouse button; `0` fits.
7. **`Ctrl/Cmd + S`, or the green "Guardar en el archivo" button** — writes the
   island's array and Vite's HMR reloads it. "Copiar arreglo" stays as a
   fallback for when the dev endpoint isn't there.

Everything the editor stores is resolution-independent: position in **% of the
stage**, sizes as **scale factors**, tilts in **degrees**. It never writes a
pixel — that is what used to break at other resolutions.

**Why the number needs its own offset (`numX` / `numY` / `numSize`).** The
number is drawn at the centre of the node box, which is the centre of the
button PNG. The button image gets the node's tilt and scale; the number
deliberately does **not** — it keeps the base camera angle so it stays readable
on a steeply tilted node. The moment a node is tilted or scaled, therefore, the
canvas centre stops coinciding with the visible centre of the raised disc, and
the number reads as off-centre. These three fields correct it per level.

They are in **% of the button's width** (`cqw`), never pixels: the node declares
`container-type: inline-size`, so a `numY: 2` is 2 % of that button's width at
any resolution and the correction scales with the button. The same rule as
everything else here — a pixel offset would be right at one screen size only.

**The pressed state needs its own pair.** When a button is pressed its disc
sinks, and *how far* is decided by each island's art — a cookie and a stone ring
do not travel the same distance. `numXHover` / `numYHover` hold the number's
position in that state; left undefined they fall back to the resting pair. Note
they are written even when `0`, because "absent" and "zero" mean different
things here. The generic sink itself used to be a hardcoded `-6px → -1px`, which
made the effect a different size on every screen; it is now `-5.85cqw →
-0.97cqw`, the same values converted at the 1920×1080 reference.

**Editing the pressed state needs the toggle**, not the mouse: to see it by
hovering you would have to hold the pointer over the node, and then the keyboard
is unusable. That is what "Ver apretado" is for.

The panel also has a **"NumSize global"** slider. That one multiplies every
number on the island and is **not saved** — it is for eyeballing a global size
before hard-coding it in `IslandDetailPage`. The per-level `Num tamaño` is the
one that persists.

**The zoom is a lens, not a state.** It is a CSS `transform` on a layer wrapping
the whole stage, so it changes nothing in the data: `pctFromClient` keeps working
untouched because `getBoundingClientRect()` already returns the transformed rect.
Verified: at 1.95x, clicking a node's visual centre still reports its exact
stored `x` / `y`. Two details that are easy to get wrong if this is ever
reworked — the transform goes on its **own layer**, not on `.island-stage`, whose
entrance animation also animates `transform` and would fight it; and the HUD
panel is rendered through a **portal to `<body>`**, or the lens would magnify the
control panel along with the map.

The write endpoint lives in `scripts/vite-plugin-level-positions.ts`, registered
in `vite.config.ts` with `apply: "serve"`, so it exists only under `vite dev`
and never reaches the production bundle or the Nginx container. It preserves the
comment block at the head of each island's array and the per-line trailing
comments.

To check placement without opening the app:

```bash
node scripts/preview-level-positions.mjs                    # las 15 islas
node scripts/preview-level-positions.mjs island6 --grid     # con grilla de %
node scripts/preview-level-positions.mjs island6 --zoom 62,26,20   # x,y,span%
```

It draws each node over the real art at its true relative size (the same
5.34 %), writing PNGs to `.preview-niveles/` (gitignored). Needs
`npm install sharp --no-save`. Use it to confirm a node sits on its disc before
and after editing `levelPositions.ts`; the `--zoom` view carries a fine
percentage grid so you can read a platform's centre straight off the image.

### 6.2 Phones — explore-only (implemented)

**The decision.** On a phone the whole game is browsable and **no level is
playable**. A kid can log in, walk the world map, open any island, tap a level
and read its card — and progress nothing. Everything earned on a computer shows
up here read-only.

The reason is not laziness about layout: TYPELY teaches touch-typing on a
**physical keyboard**, and a phone has none. Making levels "work" on a phone
would mean turning the on-screen keyboard into the input, and that contradicts
the rule in §6.5 that it is a *map for finding the real key*, not a thing to
tap. A kid who passes levels by tapping the screen is not learning what this
game teaches.

#### The breakpoint

**Width ≤768px. Never touch detection** — the classroom Chromebooks are touch
and must stay fully playable; a pointer/hover query would lock out the primary
device.

A phone in landscape is ~812 wide and would slip through a width-only rule with
375px of height, so it needs its own condition, narrow enough that a short
desktop window is not caught by it:

```css
@media (max-width: 768px),
       (max-height: 480px) and (max-width: 950px) { … }
```

Tablets (768–1024) count as computers and play normally.

#### Inside an island — zoom and pan

Do NOT try to fit the whole island on screen. `contain` on a 375×812 phone
leaves the stage at 375×211 — a strip — and since each node has a 44px touch
floor it swells to 11.7 % of the stage instead of the correct 5.34 %, so the
nodes overlap.

Instead the island gets **zoom + drag**, the same gesture as the visual editor:
pinch or double-tap to zoom, one finger to pan around it. **Level coordinates
do not change.** `levelPositions.ts` stays the same reference system — only the
window onto it moves, so every placement done with the dev tool keeps working.

**The opening animation is the tutorial, and its timing is the point.** The
island opens **unzoomed, whole**, so the kid sees where they are. Then — *only
once the island art has actually loaded*, never before — it plays a **slow zoom
toward the ship**, which sits on the current level. Two things fall out of that
one move: the kid arrives already looking at what they have to play next, and
they have just *seen* the map zoom, so they know it is something they can do
themselves. Firing it before the art loads wastes it: there is nothing to watch
zoom in.

Reuse what §6.1 already documents about the editor's lens, because the traps
are the same: the transform goes on **its own layer**, not on `.island-stage`
— that element's entrance animation also animates `transform` and the two
fight — and the HUD is rendered through a portal so the zoom does not magnify
it. `getBoundingClientRect()` already returns the transformed rect, so the
percentage maths keeps working untouched.

One known wrinkle: the popover's collision logic (`useLayoutEffect` in
`IslandDetailPage`, keyed on `viewportTick`) clamps against the **viewport**.
With a zoomed, pannable stage that maths has to account for the pan offset.

`.island-backdrop` sits outside the moving layer, so it stays put while the map
moves — a free parallax.

#### The world map — fewer islands, bigger

`/mundos` already scrolls horizontally and that stays. What changes is how much
it shows at once: **one island, at most two**, instead of compressing the whole
desktop layout into a narrow screen, which is what it does today and looks bad.

- Horizontal is free: on a screen that already scrolls sideways, content
  hidden past the edge costs nothing.
- **Vertical must keep showing the same** as on a computer — nothing gets cut
  off the top or bottom.
- Islands can be drawn **bigger** so they fill the screen properly.
- The mascots shrink to fit instead of crowding the map.

#### Levels — closed, and closed at the URL too

Tapping a node **opens its card as usual** — name, subtitle, stars earned — but
**without the play button**, replaced by a line saying the level is played on a
computer. The kid keeps exploring instead of hitting a dead end, and still sees
what they earned.

Blocking the button is not enough: `/gameplay/<id>` has to be **guarded on the
route**, or a shared link, a bookmark or a rotation drops a phone straight into
an unplayable screen. Today that screen is genuinely broken — the keyboard
overflows past the right edge with no way to reach the missing keys, the
mission sits under the corner buttons, and the mascot speech bubbles cover the
home row.

#### Scope

**Every student screen except the level itself**: login, the world map, the
island, achievements/rewards, missions and the account. All of them browsable
on a phone. Only `GameplayPage`, `ShortcutLevelView` and `SkillLevelView` are
closed.

Login, `/logros`, `/misiones` and `/mi-cuenta` needed **no work**: they are
column-of-cards layouts that already reflow, and none of them overflows
horizontally at 375px. Only the two game screens — the world map and the island
— had to change, because only those two paint on a fixed stage.

#### Where the code lives

| Piece | File |
|---|---|
| What counts as a phone | `src/hooks/useEsCelular.ts` — `CONSULTA_CELULAR`, `esCelular()`, `useEsCelular()` |
| Route guard on the level | `src/components/common/SoloEnComputadora.tsx`, wired in `App.tsx` |
| "Played on a computer" line | `AvisoSoloEnComputadora`, same file, rendered by the island popover |
| Zoom + pan, opening animation | `src/pages/IslandDetailPage.tsx` |
| One island per screen | `src/pages/WorldsPage.tsx` |

Three things are worth keeping straight, because each was a real trap:

- **The breakpoint is read in ONE place.** `useEsCelular` is the only thing that
  decides. Do not re-test the width inline anywhere — that is how the guard and
  the popover drift apart and a phone gets a play button that leads nowhere.
- **The zoom lens is its own transform layer**, exactly as §6.1 warns. Putting
  it on `.island-stage` makes it fight that element's entrance animation, which
  also animates `transform`.
- **The world map scales the TRACK, not the islands' coordinates.**
  `escalaMapa` (1 on a computer, 3 on a phone) multiplies the track width, the
  SVG viewBox and each island's `left`, so the same layout simply spreads out.
  Island positions are untouched, and the desktop path is byte-for-byte the old
  one because it multiplies by 1.

The opening animation waits for the island art to load, then eases to the
current level over 1900ms at `ZOOM_CELULAR = 2.2`. Both numbers are tuned to be
watchable — the point is that the kid *sees* the zoom happen and learns the
gesture, so making it faster defeats it.

### 6.3 Island art — one folder per island

**Everything an island draws lives in that island's folder, and the path is
built from its `worldId`.** There is no index, no parallel array, no lookup
table to keep in order:

```
public/assets/islands/islandN/     ← shipped, WebP only
  scene.webp           the whole painting, sky and island together — ONLY
                       while that island is not split yet
  sky.webp             the background alone, no platforms — only once split
  island.webp          the island cut out, with alpha — only once split
  map.webp             the thumbnail on the world map
  gameplay.webp        the level scene: island seen from the ground, with a
                       painted pedestal the keyboard rests on. 1672x941, all
                       fifteen are their own painting — recipe in FONDOS.md
  button.webp          level button, free
  button-pressed.webp  level button, pressed
  ui/                  level interface (not built yet)

Images/islands/islandN/            ← sources, never shipped
  scene-source.png|webp, island-source.png, sky-source.jpg,
  button-sheet.png, map-hi.webp, …

public/assets/islands/_default/    ← fallback button for a world with no art yet
public/assets/islands/_backups/    ← pre-colour-pass originals (gitignored)
```

Resolution goes through `islandArt()`, `islandMapThumb()`,
`islandGameplayBg()` and `levelButtonFor()` in `src/utils/assets.ts`. The only
table left is `ISLAND_ART`, one row per island, and the only thing a row can
say is whether that island's art is already split.

**Why this replaced what was there.** The art used to be spread across five
folders (`typely_islands_webp`, `typely_islands_thumb_webp`,
`typely_backgrounds_webp`, `typely_gameplay_background_webp`,
`assets/edutic-art/`), addressed by three parallel arrays indexed by an
"expansion index" that was offset by five from the world number. Island 6's
thumbnail was a file named `background-island1.webp`. Nothing in the name told
you that; you had to know. Worlds 1-5 went down a second code path entirely.
Building the path from the `worldId` makes the offset unrepresentable.

**The background file changes name with the state, deliberately.** Unsplit it is
`scene.webp`; split it is `sky.webp`. Calling the combined painting `sky.webp`
made people open an island's folder, see no "island" file, and conclude the art
was missing — it was right there under a name that lied. `scene.webp` says what
it is, and the importer deletes it once the two real layers exist, so a folder
never holds two backgrounds. Every island also keeps a copy of its combined
scene in `Images/islands/islandN/scene-source.*`: that is the file you hand to
the model when you want it split.

**The two layers, and why they exist.** The background fills the whole screen with
`object-fit: cover` and may crop freely — nothing is positioned on it.
`island` goes in the stage box, which is sized to the island's own aspect
ratio and *contained*, so it always fits whole; the percentages in
`levelPositions.ts` are measured against that box. While an island is not yet
split, `islandArt().island` is `null`, the background is still the combined
painting, and the page reuses it blurred behind itself to fill the letterbox
bands — a stopgap, not the design.

**Splitting an island changes its coordinate system.** The stage box goes from
the combined art's aspect ratio to the island layer's. Every `x/y` in that
island's `levelPositions.ts` entry has to be placed again. Split the art
*before* positioning the nodes, never after.

**Some art is drawn to bleed, not to float — an escape hatch, not in use today.**
`.island-stage` normally uses the CSS form of `contain`
(`width: min(100cqw, 100cqh * var(--art-ar))`): the art always enters whole,
with letterbox bands if the aspect ratio doesn't match. If an island's border is
ever a hard cut that assumes more scene continues off-camera — no breathing
margin, meant to bleed — shrinking it to fit would expose that cut. For that
case only, `{ cover: true }` on its row in `ISLAND_ART` switches the stage to
`.island-stage--cover`, the same formula with `max()` instead of `min()`: the
stage always fills the viewport and *never* shrinks below it, cropping whatever
doesn't fit. `islandArt(worldId).cover` carries the flag to `IslandDetailPage`,
which toggles the class. Level nodes still measure in % of that box, so at some
aspect ratios a node can land outside the visible crop — expected with this
mode, not a bug. Island 6 briefly used it while its art had that hard cut; a
redrawn, complete version replaced it and it went back to `contain`. Reach for
`cover` only when an island's art is genuinely drawn that way — a complete
island, however busy, still wants `contain`.

**To split one**, drop two sources into `Images/islands/islandN/` and run the
importer:

| Source | Format | What it is |
|---|---|---|
| `island-source.png` | **PNG with real alpha** | the island and its platforms, cut out |
| `sky-source.jpg` | JPG or PNG | the sky behind it, no platforms |

```bash
node scripts/import-island-art.mjs island7   # or with no argument, every island that has sources
```

It writes `island.webp` and `sky.webp`, flips `split: true` in `ISLAND_ART`, and
does two things you would otherwise have to remember: it **trims the island's
transparent margin** (that margin is dead screen, because the stage box takes
its aspect ratio from this image), and it **refuses an island with no alpha
channel** — an opaque cut-out covers the whole sky and the mistake only shows up
once you open the page. Nothing is ever upscaled.

The prompts for getting those two sources out of a combined scene — and for
adding or removing a pedestal when the art does not match the level count — are
in `Images/islands/ISLAS.md`.

Command-line scripts do not read the `split` flag: `scripts/island-paths.mjs`
infers it from whether `island.webp` exists on disk, so the two cannot drift.

### 6.4 Level buttons — one themed button per island

The node the kid presses is not one shared graphic. **Each of the 15 islands has
its own button**, redesigned in the material of its terrain: stone with grass on
the green islands, ice and bronze on the clockwork one, a glazed cookie on
candyland. A grass button on a pink cake reads as a mistake, which is why one
button could never serve fifteen worlds.

`levelButtonFor(worldId, pressed)` in `src/utils/assets.ts` resolves them from
`LEVEL_BUTTON_BY_WORLD`. All fifteen are registered; an island missing from that
map falls back to the plain stone `btn-default`, which is now a safety net
rather than anyone's normal state.

**Two images per island** — resting and pressed. The game swaps them on hover,
so they must be drawn with the same camera, the same size and in the same place
on the canvas; if they differ the button jumps under the cursor.

**Storage.**

| Where | What | Tracked |
|---|---|---|
| `Images/islands/islandN/button-sheet.png` | the raw two-state sheet exactly as generated | yes, never edited |
| `Images/islands/BOTONES.md` | the full recipe for adding a new island's button | yes |
| `Images/islands/_default/REFERENCIA-boton-clasico.png` | the shape reference that goes with the generation prompt | yes |
| `public/assets/islands/islandN/button[-pressed].webp` | what the game loads | yes |
| `public/assets/islands/_backups/` | originals kept before a colour pass | gitignored |

Sheets are never edited by hand. `scripts/import-level-button.mjs` holds a table
of per-island measurements and produces both WebP in one run; re-running it
regenerates them from the untouched source.

**Geometry — the invariant that keeps them interchangeable.** Every button is
framed on a **600×445 canvas with the centre of its base at (299.5, 214)**,
inherited from `btn-default.png`. That is what lets a node's `x`/`y` mean the
same thing in every island: the coordinate lands on the base that rests on the
painted platform, not on the alpha bounding box. The importer picks the largest
scale that still fits the canvas with that centre pinned.

**Sizes are not identical, and that is expected.** Reference base width is
454 px; the fifteen land between **333 px** (island 9) and **454 px** (islands 1,
11, 14, 15). The more the decoration spills outside the footprint — maple
leaves, ferns, sand — the smaller the button has to be drawn to fit the canvas.
Practical consequence: **islands whose base came out small need a higher `scale`
on their nodes.** That is per-island tuning done once in the visual editor.

**The number's colour says one thing: done or not done.** Not completed →
**white**, on all fifteen without exception. Completed → **that button's own
colour, darkened**: the hue sampled from the disc with its lightness pushed down
until it clears contrast. A finished level then reads as engraved into its own
disc, and the one you still have to play is the only white thing on the island.

That direction matters and it used to be backwards. Completed numbers were the
**split complement** of the disc picked from a palette of vivid hues, which
contrasted beautifully and drew the eye to exactly the wrong place: the levels
already done shouted, and the next one to play got lost among them.

Two details of the derivation, both load-bearing:

- **Saturation has a floor.** Darkening a low-saturation disc in HSL lands on
  grey, and grey already means *blocked* on this screen. A completed number in
  grey reads as locked, the opposite of what it is.
- **Four discs go the other way.** Islands 3, 8, 13 and 15 are dark enough that
  nothing below them clears the floor — not even pure black. Those take a light
  **tint of the same hue** instead. Still the button's colour, still quieter
  than white.

Values live in `LEVEL_NUMBER_DONE` / `levelNumberDoneColor()`, regenerate with
`node scripts/level-number-colors.mjs`, and can be eyeballed as a contact sheet
of all thirty states with `node scripts/preview-level-numbers.mjs`.

**White survives on a pale disc because of the outline, not the fill.** Two
discs are too light for a flat white number — island 4's pale pink gave 1.71:1
and island 1's turquoise 2.81:1, both under the 3:1 floor for large text. The
fix is a dark `-webkit-text-stroke` with `paint-order: stroke`, sized in `cqw`
like everything else on the node, so the stroke paints *behind* the glyph
instead of eating it. That keeps "pending is white" true on all fifteen, which
is what makes the state recognisable from island to island; the other thirteen
just gain definition. It goes on the white only — a dark outline around an
already dark completed number would only fatten it.

Changing the art is the other available fix and is still the right one if a
disc is ever redrawn: `scripts/lighten-disc.mjs` lightens or darkens just the
disc without touching the rest — it samples the disc's own hue and matches by
hue and saturation, never by lightness, so a gradient survives.

**Adding an island's button:** follow `Images/islands/BOTONES.md`. One step
in it is deliberately manual — measuring the base on a percentage grid — and the
file explains why it cannot be automated: decoration spills outside the
footprint asymmetrically and is painted in the same material as the base, so
neither silhouette nor colour detection survives all fifteen cases.

### 6.5 The level screen — one design language for all 103 levels

Three different React views render levels (§7 says which `inputType` goes
where), but the player must not be able to tell. These rules are shared by all
three; where one differs, the difference is deliberate and named here.

**The scene is the island, not a stack of panels.** Every level screen is that
island's `gameplay.webp` — a scene with a **painted pedestal in the bottom
third** (see `Images/islands/FONDOS.md` for how those are drawn and measured).
Everything the game draws sits ON that pedestal or floats over the sky above
it. The shortcut and skill screens used to be five stacked white panels —
header, goal, a box around the simulator, metrics, footer — with the
simulator's own glass panel inside the box, two whites deep, hiding the island
completely. **Do not put a container around something that already has one.**
The virtual browser and the virtual document draw their own chrome; they need
no box. Metrics, hints and the level title are **loose text with a white halo**
(`.nv-dato`), not pills.

**The mission is the consigna, and it is the one thing allowed to shout.**
Kids were not reading the instruction — not because of the words, but because
the card looked like every other card on the screen, so nothing said "start
here". The fix has three parts and all three matter:

- It is the **only element on the screen with a lit gradient border**
  (`.gp-mision`). **Keep that exclusive.** If another card ever takes the
  gradient border, the consigna goes back to being invisible.
- A gold badge **names** it — "Tu misión", "Paso 2 de 5", "Objetivo 1 de 5".
  Game language, not school language.
- The **listen button lives inside it**, big and in front. It used to be a
  small round icon in the top-right corner among three others, where it did
  not read as "this can be heard" — which is exactly what the kid who cannot
  read fluently needs. It is never in the footer or the corner again.

It announces itself on entering the level (bounce, gold halo, the audio button
pulsing three times) and then drops to rest so it stops competing with the
target. It lights up again on the **existing idle trigger** — the same one that
pulses the hint key — because a kid who has gone quiet is a kid who does not
know what to do. It does **not** re-fire per objective: by the third correct
answer that is noise, and noise becomes invisible.

It does **not** auto-read on entry. Twenty-five Chromebooks all speaking at
once is a real classroom problem; the pulsing button is the affordance instead.
That is a one-line change if it ever gets tested and wanted.

**The keyboard is inert where you type and clickable where you cannot.** This
is the one deliberate difference between the views, and getting it backwards
breaks either the teaching or the level:

| View | On-screen keys | Why |
|---|---|---|
| `GameplayPage` (typing) | **Inert.** `<span>` + `pointer-events: none` | The board is a *map* for finding the key on the real keyboard, which is the thing being taught. They were `<button>`s with hover that did nothing on click — promising an interaction that never came, and a kid who thinks the mouse can solve the level stops looking at their hands. |
| `ShortcutLevelView` | **Clickable**, and visibly so — hover lift, pointer cursor, larger (`.nv-tecla`) | Ctrl+T and Ctrl+W never reach the page (§ the Keyboard Lock note in that file). Without tappable keys those levels are impossible to finish. |

**Sizes and materials.** Keys are **52×46 px** at rest: the classroom
Chromebooks are touch, and below 44 px a finger misses. The compact-height
pass at the end of `global.css` shrinks them (2.35 / 2.00 / 1.75 rem) only when
the window is genuinely too short. The target is an **ice plate** (`.gp-placa`)
and the objective bar a **crystal vein** (`.gp-riel` / `.gp-veta`), both drawn
to belong to the island rather than sit on top of it.

**On the dark islands, loose text is the weak point.** Islands 6, 14 and 15
have near-black pedestals, and dark navy text with a thin white shadow does not
separate from them. `.nv-dato` therefore carries a **three-layer** halo. If a
future island goes darker still, the next move is a faintly tinted pill behind
the text — accepting that it costs some of the cleanliness.

**Never restyle `glass-surface` to fix a level screen.** Half the app uses it
(admin panels, toasts, map cards). The level-screen classes are their own:
`.gp-*` for the typing screen, `.nv-*` for the shortcut and skill screens.

### Login mascots — flanking robots
The two login robots are positioned inline in `LoginPage.tsx` with Tailwind
viewport units (no dedicated CSS class anymore): female left
(`bottom-[17.5vh] left-[5.5vw] max-h-[62vh]`), male right
(`bottom-[7.5vh] right-[8vw] max-h-[72vh]`). They're sized purely by height
so both scale together; the `bottom` offsets stand each robot on a painted
island. Tune those four values for placement/size. The login card is fixed
at `w-[min(32rem,92vw)]` with the original (non-fluid) typography — do NOT
reintroduce vmin-clamped fonts on the login card (it ballooned the UI and
pushed buttons off-screen on short displays).

## 7. Gameplay Curriculum

Defined in `src/data/activities.ts`. Each `Activity` carries `worldId`,
`levelNumber`, `inputType` (`letter | word | phrase | symbol | correction |
shortcut | skill`), `mode` (`assisted | independent`), optional `requiresShift`
/ `requiresAccent`, and a `targets[]` array.

**`inputType` picks the view.** Three render levels, and the player must not be
able to tell (§6.5):

| `inputType` | View | Levels |
|---|---|---|
| `letter · word · phrase · symbol · correction` | `GameplayPage` | 74, on 11 islands |
| `shortcut` | `ShortcutLevelView` | 22 — islands 11, 12, 14 and island 15 level 5 |
| `skill` | `SkillLevelView` | 7 — island 5 |

- There are **15 worlds** (`island1..island15`) in difficulty order. The
  **level count is per-island, NOT fixed** — it is driven by the number of
  `Activity` records for that world. To add a level you must add BOTH a new
  `Activity` AND a matching coordinate in `src/data/levelPositions.ts`.
- Difficulty rises by world: letters → words/phrases → mayúsculas, ñ, tildes,
  inverted signs `¿ ¡` → punctuation, symbols, emails, real questions, and
  beyond (digital-skills worlds).
- Helpers: `getActivityById(id)` (falls back to first), `activitiesByWorld[worldId]`.
- Level ↔ activity id mapping: `<worldId>-l<level>` for worlds 2+, legacy ids for
  world 1 (`letter-a1 … backspace-a1`).

### 7.1 A level is ONE task, not a list of repetitions

This is the rule the curriculum was rebuilt around, and it is worth stating
plainly because the old shape looked reasonable and taught almost nothing.

Levels used to be a list of the same shortcut repeated — `["Ctrl+T", "Ctrl+T",
"Ctrl+T"]` — over a simulator that **reset on every attempt**: you opened a tab,
it vanished, you opened the same tab again. Nothing you did stayed done, so the
shortcut did nothing *within the level*. Worse, some orders were impossible and
therefore taught the wrong model: copying before selecting, redoing before
undoing.

A level is now **one task told step by step**, via `steps` on the `Activity`:

- Each `ShortcutStep` carries the `combo` **and the reason** — "cerrá el
  anuncio que se abrió solo", not "hacé Ctrl+W".
- **The simulator keeps its state between steps.** That is what makes
  copy-and-paste legible: what you selected is still highlighted when you copy,
  and the clipboard is full when you paste. Without it the pair never
  connected.
- Consequences are real and visible: what you open **stays open** until you
  close it; what you close is gone.
- Repetition needs a cause. Saving twice is fine if something changed in
  between; three identical saves is not a level.

Two mechanical constraints that bite when writing new levels:

- **The simulator remounts when the *scene* changes**, so a level may go
  browser → editor but **never back**. Returning to a previous scene restarts
  it and cuts the task in half. Islands 6, 14 and 15 do all the browser work
  first, then all the document work.
- **A shortcut the browser owns never reaches the page** — Ctrl+T, Ctrl+W,
  Ctrl+N, Ctrl+Tab and their Shift variants. `ShortcutLevelView` captures them
  with the Keyboard Lock API in fullscreen, and always keeps the tappable
  on-screen keys as the fallback (§6.5). **Alt+Tab belongs to the OS and cannot
  be captured by any technique — never put it in a level.**

### Digital-skills scaffold
`src/data/digitalSkills.ts` defines a parallel `SkillChallenge` model (mouse,
touchpad, windows, tabs, shortcuts, text editing, UI literacy). `SkillLevelView`
/ `ShortcutLevelView` render these; `SkillChallengeShell` provides the pastel chrome.

## 8. Progress Persistence

`src/utils/progress.ts` maneja `localStorage.edutic_progress_v1` →
`Record<WorldKey, Record<levelNumber, LevelProgress>>`, y lo sincroniza.

- `markLevelComplete(worldId, level, accuracy, attempts)` al terminar un nivel:
  escribe local (instantáneo) y **encola** el envío al servidor.
- `flushProgressQueue()` vacía la cola. Se reintenta al terminar el siguiente
  nivel, al volver la conexión (`online`) y al entrar al mapa. Es seguro
  porque el endpoint es idempotente: el servidor guarda el MEJOR resultado.
- `hydrateProgress()` trae el progreso del servidor al entrar y lo fusiona
  con lo local quedándose con el mejor de cada lado. Esto es lo que hace que
  el progreso sobreviva a cambiar de computadora o borrar el caché.
- **Nada de esto corre en modo demo**: sin cuenta no hay a dónde sincronizar.
- `levelState()` → `"Completado" | "Actual" | "Bloqueado"`;
  `getCurrentLevelNumber()`; `resetProgress()`.
- `src/data/worlds.ts` reconstruye `World.levels[]` en cada render desde
  `activitiesByWorld` + el snapshot de progreso.
- El orden de mundos es `WORLD_PEDAGOGY_ORDER`; cada uno muestra su
  `displayNumber` pedagógico (ej. "M3").

### 8.1 Modo Órbita (arcade)

El segundo eje del producto: minijuegos infinitos y rejugables, medidos por
supervivencia y velocidad — no por completación. El primero es **Tormenta de
palabras** (`/orbita/tormenta`). La especificación de diseño completa vive en
el artefacto "Tormenta de palabras"; acá va lo que hace falta para tocar el
código sin romper sus reglas.

**El alumno entra por `/modos`** (la puerta post-login de `routeForRole`): un
selector de ORBES DE CRISTAL — Aventura (las islas), Órbita, y un orbe dormido
para modos futuros. Las rutas: `/orbita` (hub), `/orbita/tormenta` (el juego,
con `SoloEnComputadora` igual que los niveles), `/orbita/ranking`,
`/orbita/hangar`. Todo lazy.

**El motor es puro y la promesa se verifica por simulación.**
`src/utils/orbita/motor.ts` no toca DOM: un controlador de lazo cerrado mide
PPM×precisión^1.7 en ventana de 10 s, estima el techo del jugador (R̂, solo
sube) y exige `R̂ × (1 + margen(t))` con un margen que va de **−15 % al
arrancar a +35 % a los 120 s** y sigue creciendo (exponente 2) — la partida
BASE dura ~2:00 PARA CUALQUIERA por construcción; las mejoras permanentes
(más abajo) la estiran, con un corte duro a los 3:45. Los primeros 4-10 s son un **vuelo de prueba**: llueven
palabras cada vez más rápido (tres en pantalla, sin asomo de banda, intervalo
≤ 2,5 s) y nada lastima. El vuelo corta cuando el tope de tres queda lleno
1,5 s seguidos, cuando una palabra casi impacta, cuando el chico lleva 2,5 s
ocupados sin mejorar, o a los 10 s. El techo NO sale de la demanda final (la
sonda sobrepasa siempre) sino de lo que las manos hicieron: teclas correctas
sobre tiempo OCUPADO (esperar palabras no es lentitud), con el ritmo dentro
de la palabra y la sobrecarga por palabra medidos aparte y extrapolados al
largo de la banda en la que va a jugar — el vuelo mide en palabras cortas,
donde manda la reacción, y un tipeador de 60 PPM medía 25. Las sobrevivientes
del vuelo reciben 40 % más de viaje. En la partida, si el chico vacía la
pantalla y espera más del 15 % del intervalo entre palabras, R̂ **empuja**
(25 %/s; 30 %/s en el vuelo): la adaptación es por lo que hacés, no por
reloj. Tres frenos a ese empuje, y los tres fueron trinquetes reales: no
cuenta mientras una *bala*, un *crítico* o una *onda* vacían la pantalla; nunca
lleva R̂ más allá de 1,35 × la demanda; y la cadencia se mide contra el largo
REAL de la última palabra, no contra el largo medio de la banda (un "@" de la
banda de símbolos dejaba la pantalla vacía todo su intervalo y R̂ pasaba de
50 a 102 en cinco segundos). Dos exámenes, y hay que correr los dos después
de tocar cualquier valor de `AJUSTES`: `node scripts/simular-tormenta.mjs`
(seis tipeadores sintéticos de 8 a 85 PPM que eligen cartas al azar; los
seis tienen que caer en 90–180 s de mediana y NINGUNA partida pasa de 225 s)
y `node scripts/jugar-tormenta.mjs` (trece jugadores guionados — el que
arranca mal y termina brillante, el que se distrae, el que no toca nada, y
tres builds fijas: defensiva, ofensiva y cazador de balas — con métricas de
sensación: huecos, ahogo, en qué segundo se pierde cada corazón, amenaza en
el tiempo, niveles y build, invariantes del sorteo). Los dos aceptan `--ajuste clave=valor` para probar una perilla
sin editar el motor. No dar por buena una calibración que no pase los dos.

**Mejoras permanentes por nivel** (2026-09-05, diseño en el artefacto
"Mejoras de Tormenta"; reemplazaron a los siete poderes que caían al azar).
El puntaje cruza umbrales geométricos (`nivelUmbral0: 250` × `nivelRazon:
1.5`ⁿ, el primero a los ~20 s); en cada uno el motor se PAUSA (`eligiendo`),
sortea tres cartas por rareza (común 65 · rara 28 · épica 7) y espera
`elegir()`, que rechaza lo que no ofreció. Se elige con las teclas 1-2-3 o
tocando, sin cuenta regresiva ni "volver a tirar". Trece mejoras
(`MEJORAS` en el motor, `MejoraId`), cada una con su tabla por nivel en
`AJUSTES`: bala extra (el rayo se bifurca y cae también la más urgente —
mitad de puntos, sin racha), segunda oportunidad, +1 vida (tope blando 5),
regeneración (30/20/12 s), escudo latente (20/12/8 s sin daño), golpe
crítico (15/30/45 % con palabra limpia), viento a favor (8/15/20 % más
lento), foco (la más urgente marcada y apuntada sola), onda de choque (al
subir de nivel y cada 12/8 palabras), congelar al errar (0,5/0,8/1,2 s con
cooldown FIJO de 12 s: si mejorara el cooldown, errar a propósito sería
estrategia), imán, racha blindada (perdones que se renuevan por nivel) y
teclas difíciles (×1,5/2/2,5 por mayúsculas, tildes y símbolos). Topes
duros salen del sorteo; los blandos (bala, vida) quedan con peso chico —
con suerte pueden tocar igual. Se fue el impuesto por poder
(`margenPorAuxilio`): las mejoras VALEN, y el techo lo ponen la curva del
margen y `duracionTopeSegundos: 225` — la amenaza está topeada en 100, así
que un tipeador perfecto con Viento e Imán la sostenía indefinidamente. Los
cristales se acuñan sobre lo TIPEADO (`palabrasTipeadas`), nunca sobre lo
que cayó por bala o crítico; el servidor recibe nivel y build (migración
`0004`, columnas `words_typed`, `level`, `upgrades`) y `validarCoherencia`
sabe cuántas palabras puede arrastrar cada bala. Las gemas de las mejoras
son las mismas gemas redondas de los poderes (cuatro reusadas: lento →
viento, mira → foco, escudo, pulso → onda; reparación → +1 vida) más ocho
nuevas (`ORBITA.md` §7.6); la rareza va en el marco de la carta (CSS),
nunca en la gema. Al subir de nivel hay que ELEGIR también en los exámenes:
los jugadores guionados leen `motor.eligiendo` después de cada tick y de
cada tecla, porque el nivel sube dentro de `tecla()`.

**Reglas que no se negocian:**

- **Órbita no reparte estrellas.** Las estrellas abren mundos y evolucionan la
  nave; el arcade acuña CRISTALES (cosméticos del hangar, nunca ventaja). Si
  el arcade diera estrellas, un chico abriría la isla 8 sin jugar la 7.
- **No hay teclado en pantalla, ni tenue.** Mirar hacia abajo es perder; sacar
  la vista del teclado físico es lo que este modo entrena.
- **Alias, nunca nombre real, hacia afuera.** El ranking global cruza escuelas
  y son menores. El nombre real solo lo ve quien ya tiene alcance sobre ese
  alumno (docente/admin de su sede). El servidor valida el alias (sin nombre
  real ni usuario adentro) y limita el cambio a uno por semana.
- **El servidor es escéptico.** Cada partida llega con telemetría completa y
  se valida coherencia (`validarCoherencia` en `api/src/routes/arcade.ts`);
  la que no cierra se guarda con `ranked=false` — no compite ni acuña. Los
  cristales los recomputa el servidor, nunca se acredita lo que diga el
  cliente sin tope.
- **El corpus sale del currículum** (`src/data/orbitaCorpus.ts`: once bandas
  desde los `targets[]` reales, en orden pedagógico) y el techo del alumno es
  su banda desbloqueada +1 de asomo — nunca símbolos que jamás vio.
- **El demo juega y no manda nada**: sin cuenta no hay ranking ni cristales.
- **El docente puede pausar el modo por grupo** (`groups.arcade_enabled`,
  toggle en la pantalla de islas del grupo). El orbe se ve dormido, nunca
  desaparece ni queda como botón muerto.
- La partida **se pausa sola con la pestaña oculta** (rAF + recorte de dt en
  el motor): una interrupción de aula no regala impactos. Cuatro ganchos
  existen SOLO en dev y no aparecen en producción: `?bot=N` corre el bucle
  por intervalo a N× (para verificar desde una pestaña oculta, donde no hay
  rAF, antes de que el cliente de Vite recargue), `window.__tormentaTecla`
  tipea por el mismo camino que el teclado, `window.__tormentaVivas` da la
  lista viva del MOTOR (el DOM entre dos pintadas de React miente), y
  `?banda=8` fuerza la banda máxima de corpus (0-10) para probar símbolos o
  correos sin pasarse cinco islas. Ojo con `?bot=4`: una partida sin teclas
  termina en 22 s de juego, o sea 5 s de pared — el bot hay que inyectarlo
  antes de que termine la cuenta regresiva.

**Persistencia:** mismo contrato que el progreso — localStorage al instante
(`typely_orbita_*`), cola con reintento a `POST /api/arcade/run`, cache de
perfil. Ranking semanal por `week_key` ISO calculada con huso argentino.
Tablas `arcade_profile` / `arcade_runs` (migración `0003_arcade.sql`); el
catálogo del hangar está duplicado a propósito cliente/servidor y manda el
del servidor.

**Estética: el mismo cuento de las islas, de noche, visto desde arriba.**
Índigo (`#141b4d`) en vez de negro; el tinte de la amenaza va de pervinca a
violeta a coral (`TINTE_PARADAS`, espejado en `preview-orbita-fondo.mjs`);
los destellos son de cuatro puntas ✦ como en el cielo de día; y toda tarjeta
fuera de la escena del juego es el **vidrio de marca** (`.orb-vidrio`,
`.orb-pildora`, `.orb-boton-primario`, `.orb-boton-vidrio`, `.orb-campo`):
blanco esmerilado con blur, resplandor turquesa/violeta/rosa y texto azul de
tinta, el mismo de la tarjeta de login. Dentro de la escena el HUD sigue
siendo texto suelto con halo, nunca tarjetas. Las palabras que vuelan nacen a
19 px y llegan a 64 px sobre la nave (`posicionDe`, escala 0,6 → 2,0 sobre
2rem), con estela hacia atrás, "pop" al nacer, tambaleo que crece con la
cercanía y latido coral pasado el 72 % del viaje; las mayúsculas van doradas
y un 30 % más grandes; y el texto va SIEMPRE derecho — es un juego de tipeo,
nada rota salvo las letras de una palabra que ya murió. Lo que se ve grande (insignia
del resultado y del podio, gemas de las cartas y de la build, cristal del
saldo) son objetos 3D generados en `public/assets/orbita/{insignias,gemas}/`
que `InsigniaRango tamano="grande"` y `Gema` cargan con respaldo SVG; el
horizonte de las islas (`fondo/horizonte.webp`) y la estación del hub
(`hub/estacion.webp`) se ocultan solos hasta que existan. Las fichas y los
prompts de esas piezas están en `Images/orbita/ORBITA.md` §7; el importador
las mide (`node scripts/import-orbita-art.mjs`) y `preview-orbita-fondo.mjs`
apila el horizonte con palabras encima para aprobarlo. Ojo Chrome:
`background-clip: text` no convive con `filter` en el mismo elemento — por
eso la cuenta regresiva usa el envoltorio `.orb-cuenta-halo`.

**CSS:** prefijo `.orb-*` en `global.css`, antes del compact-height pass. El
borde de gradiente sigue siendo exclusivo de la consigna; Órbita no lo usa.

## 9. Project Structure

- `src/App.tsx` — routes + protected-route composition (lazy-loads heavy pages).
- `src/pages/` — **solo el juego**: `LoginPage`, `ChangePasswordPage`,
  `WorldsPage`, `IslandDetailPage`, `GameplayPage`, `SkillLevelView`,
  `ShortcutLevelView`, `RewardsPage`, `AccountPage`, `MissionsPage`. Los
  editores de diseño (`GlassEditorPage`, `LoginLayoutEditorPage`) existen
  **solo en desarrollo**. Las pantallas de docente y administración se
  borraron y se rehacen de cero.
- `src/components/` — `auth/`, `common/`, `dev/` (editores de posiciones y
  layout), `digitalSkills/`, `layout/TopNav`.
- `src/data/` — `activities.ts`, `worlds.ts`, `levelPositions.ts`,
  `digitalSkills.ts`, `achievements.ts`.
- `src/hooks/useAuth.tsx` — sesión contra la API. Sin fallback local.
- `src/utils/` — `api.ts` (cliente tipado), `assets.ts`, `progress.ts`
  (local + cola de sincronización), `storage.ts` (solo modo demo y rutas por
  rol), `image.ts`, `userContext.ts`.
- `src/styles/global.css` — entire visual system + page CSS + the responsive pass.
- `api/src/` — `server.ts`, `auth.ts`, `rbac.ts`, `authContext.ts`,
  `userIdentity.ts`, `audit.ts`, `stats.ts`, `db/{index,schema,migrate}.ts`,
  `scripts/bootstrap.ts`, `routes/{auth,users,groups,sedes,progress,import,admin,inspector}.ts`.
- `api/migrations/` — SQL numerado, la fuente de verdad del esquema.
- `public/assets/islands/islandN/` — **all the art of one island, together**:
  sky, island, map thumbnail, gameplay scene and level button. Path built from
  the `worldId`; see §6.3.
- `public/assets/edutic-art/` — everything that is NOT an island: mascots,
  ships, skins, login and home backgrounds.
- `Images/islands/islandN/` — the sources of that island (sheets, PNGs, hi-res),
  mirroring the shipped folder. Never published.
- `Images/brand/` — portadas y material de presentación (posts, banners). **No
  lo usa el juego**: `.dockerignore` deja `Images` afuera del contenedor, así
  que nada de acá se sirve. Ver su `README.md`.
- `Images/`, `Images-new/` — **original source art (never modified).**

### Where the docs live

One rulebook, three companion docs, two stubs. Nothing else should grow into a
second source of rules:

| File | Job |
|---|---|
| `CLAUDE.md` | **The rulebook.** Architecture, design, assets, curriculum, deploy, branching, agent rules |
| `DEPLOY.md` | Deploy runbook — manual, through Coolify |
| `dbnew.md` | Backend implementation log (history, not rules) |
| `Images/islands/ISLAS.md` | Prompts for splitting a scene into sky + island, and for fixing pedestal count |
| `Images/islands/BOTONES.md` | Recipe for drawing and importing a new island's level button |
| `Images/islands/FONDOS.md` | Recipe for the gameplay background: measured safe zones, the mould prompt and the per-island one |
| `Images/brand/README.md` | The three cover images — which one for which format, and why the logo is baked in |
| `README.md` | Public-facing intro; points here for anything authoritative |
| `AGENTS.md` | Stub so non-Claude agents land on `CLAUDE.md` |
| `.cursor/rules/project.mdc` | Stub so Cursor's always-apply rules land on `CLAUDE.md` |

`ENGINEERING_RULES.md`, `Skills/skill.md` and the seven condensed
`.cursor/rules/*.mdc` files were folded into this one and deleted: they had
drifted apart from each other on the branching rules and the login card spec,
and each agent was reading a different version of the truth.

## 10. Asset Pipeline

Originals in `Images/` and `Images-new/` are **never** modified. Web copies live
in `public/assets/` and are produced by the Python helpers
(`Images-new/process_mecano.py` for mascots/favicons, `process_ships.py` for
ships): verify alpha, **trim transparent padding**, downscale to a 1024px longest
edge.

- Reference assets by their stable names via `src/utils/assets.ts` — do not rename.
- The login web copies are kept trimmed (character fills the frame, no dead
  padding) so positioning is predictable — e.g. `mascot-women-wave.webp` is
  ~706×1024 (trimmed from the 1254² source). When replacing art, change the
  original and re-run the scripts; keep the web copy trimmed.
- One-off image edits may use `npx`/Node `sharp` (installed `--no-save`). Local
  asset backups live in `_backups/` (gitignored, not shipped).
- **Island art has its own layout**: one folder per island, path built from the
  `worldId`, sources mirrored under `Images/islands/`. See §6.3 — it is the
  rule for every image an island draws, and it replaced five scattered folders
  addressed by offset indexes.
- **Level buttons have their own pipeline** and do not go through the Python
  helpers: raw two-state sheets in `Images/islands/islandN/`, turned into the
  shipped WebP by `scripts/import-level-button.mjs`. See §6.4 for the geometry
  contract and `Images/islands/BOTONES.md` for the step-by-step recipe.
- **Level backgrounds too**: `gameplay-source.png` per island →
  `scripts/import-gameplay-bg.mjs` → the shipped 1672×941 WebP. The importer
  centre-crops anything that is not 16:9 (and says how much it took, from
  where) and **measures the pedestal** against a keycap — the check that
  matters, because a pedestal as pale as the keys makes the keyboard vanish
  into the floor. Recipe, safe zones and the fifteen prompts:
  `Images/islands/FONDOS.md`; `scripts/prompt-fondo.mjs` prints a ready prompt
  per island and `scripts/medir-pedestal.mjs` re-checks one after the fact.

## 11. Mascots — Where They Appear

- **LoginPage:** large flanking robots (female left, male right), sized by the
  proportional formula in §6. Decorative.
- **WorldsPage:** smaller corner mascots, kept inset so islands don't collide.
- **IslandDetailPage:** *no* robots — only the ship pointing at the current level.
- **GameplayPage:** two flanking robots with motivational speech bubbles (error
  tone when accuracy < 60% with ≥1 attempt). Hidden on phones.

## 12. Behaviour Notes (gameplay / island map / login)

- **Gameplay shell** is a fixed-height (`100dvh`, `overflow:hidden`) flex column
  so the keyboard/bg/robots never shift while typing. Adaptive `target-card`
  variants (`letter | word | phrase | symbol | long`); phrases scroll on a single
  line. Level complete → modal with 3-star rating + Reintentar / Volver (no auto-
  advance). **The visual language of this screen is §6.5** — mission, inert
  keyboard, ice plate — and it is shared with the shortcut and skill screens.
- **Island map**: level bubbles sit on the painted platforms; colour = state
  (green Completado / violet Actual / grey Bloqueado). Positions are platform-
  center % coords in `src/data/levelPositions.ts`. Compact floating HUD
  (`.island-hud`) + popover beside the selected node. **Dev-only** position editor
  (`?editor=1`, gated by `import.meta.env.DEV`, stripped from prod).
- **Login card**: glass card with halo, shimmering "TYPELY" wordmark, role-aware
  form. Card width `min(32rem, …)`.

## 13. Deployment

Containerised. `Dockerfile` (frontend, multi-stage `node:22-alpine` →
`nginx:alpine`, runs `npm ci && npm run build`), `Dockerfile.api` (API),
`docker-compose.yml` (services `mecanografia`, `api`, `db`, all
loopback-bound; `db` healthcheck; `api` reads secrets from `/run/secrets/*`).
`nginx.conf` does SPA fallback. `.dockerignore` excludes `node_modules`,
`dist`, `.env*`, `secrets/*`, `Images*/`, `Skills/`, `.claude/`, docs.

**The deploy is MANUAL, through Coolify, and Ezequiel does it.** There is no
autodeploy and we do not want one: merging to `production` publishes nothing by
itself. If a workflow ever appears that deploys on push, it is a mistake —
remove it. The repo has no `.github/workflows/` for this reason.

**La base es un recurso Postgres administrado por Coolify**, en la red
compartida (`connect_to_docker_network`), con backup programado. La API se
conecta por `DATABASE_URL` y aplica las migraciones al arrancar.

**El compose NO monta secretos de Docker.** Los valores llegan por variables
de entorno de Coolify: montar `secrets/*.txt` hacía fallar el arranque porque
esos archivos no están —ni deben estar— versionados.

**El primer superadmin** se crea una vez, a mano, en la terminal del
contenedor de la API:

```bash
SUPERADMIN_USERNAME=... SUPERADMIN_EMAIL=... SUPERADMIN_NAME="..." npm run bootstrap
```

### 13.1 Qué revisar después de cada deploy

Confirmá que el bundle servido es el que quisiste publicar y que la API
respondió — esta última prueba es la que importa, porque cubre de una vez el
proxy de nginx, el arranque de la API y que las migraciones corrieron:

```bash
curl -s https://typely.becode.com.ar/ | grep -o 'assets/index-[A-Za-z0-9_-]*.js'
curl -s https://typely.becode.com.ar/api/health
```

Si `/api/health` da 502, la API no levantó: mirá sus logs, porque una
migración fallida corta el arranque a propósito.

> **Nota histórica.** Acá vivía una regla sobre `VITE_GOOGLE_CLIENT_ID`: Vite
> inlinea las `VITE_*` en tiempo de BUILD, así que si faltaban en el build el
> login con Google moría sin dejar rastro en los logs. Ya no aplica —el login
> social se eliminó— pero **el mecanismo sigue siendo cierto** para cualquier
> `VITE_*` que se agregue en el futuro: tiene que estar presente al compilar,
> no alcanza con ponerla en runtime.

## 14. Skills (for agents)

- `Skills/frontend-design/SKILL.md` — Anthropic **frontend-design** skill
  (distinctive, production-grade UI; avoid generic AI aesthetics). A working copy
  also lives at `.claude/skills/frontend-design/` for local Claude Code use.
- `.opencode/agents/` — OpenCode subagents (not Claude Code): `flash` (simple),
  `chill` (standard logic), `pro` (architecture/infra) + the
  `enrutador-complejidad` routing skill.

## 15. Non-Negotiables

- Do not modify original images in `Images/` or `Images-new/` — use the web
  copies under `public/assets/`; regenerate copies via the Python scripts.
- Do not draw islands or mascots with CSS; no background art inside bordered
  frames; no white boxes behind transparent assets.
- Keep student UI immersive and minimal — never make it look like an admin
  dashboard. Gameplay must be real and keyboard-driven, never placeholder.
- **On a level screen, do not box what is already boxed**, and do not stack
  panels over the island — the art is the scene, not a backdrop (§6.5).
- **The lit gradient border belongs to the mission alone.** Give it to another
  card and the consigna becomes invisible again, which is the bug it was
  built to fix (§6.5).
- **The typing keyboard is not clickable; the shortcut keyboard is.** Both
  directions are deliberate — see the table in §6.5 before changing either.
- **A level is one task, not a repeated key** (§7.1), and **Alt+Tab never
  appears in a level**: the OS owns it and no technique captures it.
- Respetar el RBAC: el alumno solo en superficies de alumno; el demo nunca es
  otra cosa que un alumno local; ningún rol llega a pantallas de otro rol.
- **Nunca reintroducir una base de usuarios en el navegador.** La API es la
  única autoridad sobre cuentas. Un fallback local significa contraseñas
  dentro del bundle y una lista paralela que se desincroniza.
- Nunca poner secretos en `VITE_*`: quedan incrustados en el bundle público.
  `JWT_SECRET` y `DATABASE_URL` viven solo del lado del servidor.
- Mantener el build de Docker sano; los servicios usan `expose` y no publican
  puertos en el host: el proxy de Coolify llega por la red interna. No
  publicar botones muertos.
- Spanish must be correct: tildes (á é í ó ú), ñ, mayúsculas, inverted `¿` `¡`.
- **Work on `dev`; never commit to `production` directly.** `production` is
  what is deployed, and only takes changes that already work (see §17).
- After any code change run `npm run build` (= `tsc --noEmit && vite build`); fix
  failures before claiming done. Report which files changed and how to test.
- **Never add an autodeploy.** The deploy is manual, through Coolify, and
  Ezequiel does it (§13). A workflow that publishes on push to `production` is
  a bug, not a feature.
- **No reintroducir login social sin decisión explícita.** Se quitó a
  propósito: la única forma de entrar es con una cuenta creada por un
  administrador (§4).

## 16. Quick Start

```bash
npm install          # frontend deps
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # tsc --noEmit && vite build
```

Demo: the login "Entrar en modo demo" button enters as a student. Staff/admin and
the API/DB require the backend (see `DEPLOY.md`). Reset demo data by clearing the
`edutic_*` localStorage keys (listed in `README.md`).

## 17. Branching & Git Workflow

Two long-lived branches:

- **`dev` — where the work happens.** Branch off it for anything non-trivial,
  or commit straight to it for small things. It is allowed to be broken for a
  while; that is what it is for.
- **`production` — what is deployed.** It only ever receives changes that are
  finished, working, and ready to go live. Treat it as the record of what is
  running, not as a place to work.

`dev` reaches `production` through a pull request, and only when the change is
actually operational — it builds, it runs, and you would be comfortable with it
live. Never commit to `production` directly.

```bash
git checkout dev && git pull
# …work, commit, push to dev…
# when it is genuinely ready to ship:
gh pr create --base production --head dev
gh pr merge --merge
```

**Before opening the PR into `production`**, run `npm run build`
(`tsc --noEmit && vite build`) and `npx tsc -p api/tsconfig.json`, plus the
deploy checklist in §13.

**Nothing deploys on its own.** There is no CI deploy and no
`.github/workflows/`; the old repo had one that never worked and it was
removed with the move. A merge into `production` publishes nothing — it records
what is *ready* to publish. Ezequiel then redeploys by hand from Coolify (§13).

**The rename is DONE (2026-08-30).** The repo moved to **`becodeb/typely`** and
its default branch is now **`production`**; `main` no longer exists. Only two
branches remain, `production` and `dev`, which is exactly the model described
above. GitHub's rename keeps the history and redirects old `main` links.

One loose end that came with the move and is NOT done: **`production` has no
branch protection.** The old repo's `protect-main` ruleset did not travel, so
today anyone with write access can push straight to it. Add a ruleset on
`refs/heads/production` if that matters.

**History note.** This repo previously ran `dev` → `master`/`main`, then briefly
a single `main`, and lived in another GitHub account. Older docs
describing any of that are stale — fix them.

## 18. Agent Working Rules

How to work in this repo, for humans and agents alike. These were previously
spread across `ENGINEERING_RULES.md` and seven `.cursor/rules/*.mdc` files;
they live here now.

### Before you edit

Read the relevant files, components, data models, routes and styles first. Do
not invent architecture that conflicts with what is already here. If you are
unsure of a filename, route, data shape or deployment behaviour, search the repo
and read the code — do not guess.

### While you edit

- Make **small, focused, reversible** changes. Do not rewrite a whole feature
  unless asked.
- Follow the stack and patterns already present before reaching for a new
  library or structure.
- **After 3 failed attempts on the same bug, stop and change strategy**: clear
  the relevant cache, re-read the error, inspect logs, isolate the failing file,
  try a different approach. Do not keep patching randomly. Say what failed and
  what you changed.
- Use data/config for layout, never hardcoded pixel hacks — level positions are
  percentages in `src/data/levelPositions.ts`, placed with the `?editor=1` dev
  tool (§6.1). If art shows more painted platforms than the curriculum has
  levels, the extras stay **decoration**; do not invent levels to fill them.
- Adding a level means adding **both** an `Activity` in `src/data/activities.ts`
  and a matching coordinate. Level count is per-island, not fixed.
- Clean up after the UI: cap visible toasts, and make intervals, animation loops
  and event listeners unsubscribe on unmount.
- Animations (`animejs` / `framer-motion`) only where they earn their place. No
  janky scroll, teleporting elements or infinite distracting loops. Honour
  `prefers-reduced-motion: reduce`.
- Modals and popovers must scroll when taller than the viewport
  (`max-height: 88vh; overflow-y: auto`), and fixed UI must never cover an
  interactive element.

### Never touch

Unless the user asks for it in the current conversation: `node_modules/`,
`dist/`, `build/`, `.vite/`, `package-lock.json` (unless a dependency changed on
purpose), local IDE settings (`.claude/settings.local.json`, `.vscode/`), and the
originals under `Images/` and `Images-new/`.

### Before touching auth

Verificar de punta a punta: login con **usuario** y con **email** (el mismo
campo); que un **alumno** entre —fue el bug de fondo del sistema anterior—;
que "Cerrar sesión" limpie la sesión; que cada rol caiga en
su superficie; que una contraseña temporal fuerce `/cambiar-contrasena`; y que
el modo demo siga sin tocar la API. Nunca guardar ni mostrar la contraseña
actual de nadie: solo un valor temporal recién generado, una sola vez.

### Before you call it done

Run `npm run build` (which includes `tsc --noEmit`) and fix any failure. Then
report exactly which files changed, why, and how to test the result.

### Before you tell the user to deploy

Confirm `git status` is clean for the intended change, the build succeeds, the
container rebuilt and is up (`docker compose ps`), and the smoke test passes
(`curl -I http://127.0.0.1:3005`). Only then suggest
Then hand it over: **you do not deploy** — Ezequiel redeploys manually from
Coolify (§13). Never suggest wiring an autodeploy.

### Verify responsively

Check at 375×812 (phone), 1366×768 (Chromebook) and 1440×900 (monitor). New
phone rules go in the final RESPONSIVE PASS block of `global.css` so they win
the cascade without disturbing desktop or Chromebook (§6).
