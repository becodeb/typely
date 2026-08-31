# TYPELY

App de mecanografía y alfabetización digital para chicos de primaria. En
español rioplatense, pensada para Chromebooks táctiles de aula.

El alumno recorre quince islas flotantes: aprende a ubicar las teclas,
escribir letras, palabras y frases, usar Shift, Backspace, tildes y la ñ, y
más adelante atajos de teclado y habilidades digitales. Gana estrellas,
desbloquea personajes y avanza por un mapa.

Alrededor del juego hay un sistema de gestión: una escuela carga sus cursos,
sus alumnos y sus docentes, y sigue cómo va cada uno.

**En producción:** https://typely.becode.com.ar

---

## Qué necesitás para empezar

Pedile estos accesos a **Ezequiel Fernández Cruz** (`ezequiel@fernandezcruz.com.ar`),
que es quien mantiene el proyecto y hace los despliegues:

| Acceso | Para qué |
| --- | --- |
| Repo `becodeb/typely` en GitHub | El código. Trabajás en `dev`. |
| Panel de Coolify (`coolify.becode.com.ar`) | Ver logs, variables de entorno y desplegar. |
| Una cuenta de superadmin en la app | Entrar al panel de gestión y probar el circuito real. |

**Los secretos no están en el repo y no tienen que estarlo.** `DATABASE_URL`
y `JWT_SECRET` viven como variables de entorno en Coolify (Typely →
*Environment Variables*). Si necesitás correr la API contra una base propia,
armá las tuyas: nunca copies las de producción a tu máquina.

Para el juego solo —que es la mayor parte del código— **no necesitás ningún
acceso**: cloná, `npm install`, `npm run dev` y entrá en modo demo.

---

## Cómo está armado

Tres piezas, desplegadas por Coolify en `typely.becode.com.ar`:

| Pieza | Stack | Dónde |
| --- | --- | --- |
| Frontend | Vite 7 + React 19 + TypeScript + Tailwind 4, servido por Nginx | `src/`, `Dockerfile` |
| API | Fastify + Drizzle ORM (TypeScript, ESM) | `api/`, `Dockerfile.api` |
| Base | Postgres 16, recurso administrado por Coolify | `api/migrations/*.sql` |

Un solo dominio: Nginx sirve el frontend y **reenvía `/api/*`** al contenedor
de la API por la red interna (`nginx.conf`).

**El camino caliente es local.** El motor de tipeo lee y escribe
`localStorage` para no esperar nunca a la red. Los niveles terminados van al
servidor por una **cola con reintento**, y al entrar el progreso se hidrata
desde la API — así sobrevive a cambiar de computadora.

**Las migraciones corren al arrancar la API**, bajo un lock. Si una falla, la
API no levanta: servir contra un esquema a medias hace más daño que no
servir.

### Roles

| Rol | Alcance |
| --- | --- |
| `superadmin` | La plataforma. Crea escuelas y administradores. No pertenece a ninguna escuela. |
| `admin` | Una escuela: sus grupos, sus alumnos y sus docentes. |
| `docente` | Los grupos que tiene a cargo. |
| `alumno` | Él mismo. Es quien juega. |

**Se entra con usuario y contraseña, y nada más.** No hay login social: en
una escuela las cuentas las reparte un administrador. El `username` es la
identidad principal y **el email es opcional** — un chico de primaria no
tiene, y no lo necesita: el admin le entrega usuario y contraseña impresos.

Un `admin` nunca puede crear otro `admin`. Es una regla del control de
acceso (`api/src/rbac.ts`) que la API verifica en cada alta.

---

## Levantarlo en tu máquina

Node 22 (es la versión de las imágenes de producción).

### Solo el juego

```bash
npm install
npm run dev
```

Abrí http://localhost:5173 y entrá con **"Entrar en modo demo"**. El modo
demo es una partida local, sin cuenta ni servidor: alcanza para trabajar en
las islas, los niveles, el arte y el motor de tipeo, que es casi todo.

El login real y el panel de gestión **no van a funcionar** sin la API.

### Con todo el stack local

Para tocar login, roles o el panel de gestión necesitás la API y una base.
**No hace falta ningún acceso a producción**, y no hay que copiar nada de
Coolify: la base es un contenedor descartable en tu máquina.

Necesitás Docker andando y dos archivos que git ignora — `api/.env` (base,
`JWT_SECRET`, superadmin inicial) y `.env.local` (a dónde apunta el proxy).
`.env.example` muestra qué lleva cada uno.

Con eso, un comando arma la base, aplica las migraciones y crea el
superadmin:

```bash
npm run db:local
```

Te imprime el usuario y la contraseña con los que entrás. Después, cada
servidor en su terminal:

```bash
cd api && npm run dev:local
```

```bash
npm run dev
```

Para empezar de cero —borra la base y todo lo que hayas cargado—:

```bash
npm run db:local -- --reset
```

**El proxy de `vite dev` decide contra qué backend trabajás.** Sin
`.env.local` va a producción, que es lo que sirve para trabajar en el juego
sin montar nada; con `TYPELY_API=http://127.0.0.1:3000` va a tu API. Es una
variable de entorno y no una edición de `vite.config.ts` a propósito:
editar el archivo versionado termina commiteado por accidente y le cambia
el backend a todo el equipo.

### Antes de dar algo por terminado

```bash
npm run build                      # tsc --noEmit && vite build
cd api && npx tsc -p tsconfig.json --noEmit
```

---

## Cómo se trabaja

Dos ramas largas:

- **`dev`** — acá se trabaja. Puede estar rota un rato; para eso está.
- **`production`** — lo que está desplegado. Solo recibe cambios terminados.

`dev` llega a `production` por pull request, y solo cuando el cambio
funciona de verdad. Nunca commitees directo a `production`.

**Nada se despliega solo.** No hay CI de deploy: mergear a `production` no
publica nada, solo registra qué está listo. El deploy se dispara a mano
desde Coolify.

Después de cada despliegue, la prueba que cubre más de una vez:

```bash
curl -s https://typely.becode.com.ar/api/health
```

Si da 502, la API no levantó — mirá sus logs, porque una migración fallida
corta el arranque a propósito.

---

## Qué hay y qué falta

**Andando:**

- El juego completo: 15 islas, 103 niveles, progreso sincronizado
- Login para los cuatro roles
- Gestión del superadmin y del admin: escuelas, grupos, alumnos, docentes,
  alta masiva por planilla CSV y credenciales para imprimir

**Todavía no:**

- El panel del docente
- Los tableros de seguimiento. La API ya calcula estrellas, precisión,
  racha, progreso por isla y logros (`api/src/stats.ts`); falta la pantalla.

---

## Dónde está cada cosa

`CLAUDE.md` es la fuente de verdad del proyecto: arquitectura, sistema de
diseño, currículum, reglas de trabajo y despliegue. Si algún otro documento
lo contradice, gana `CLAUDE.md` — y hay que corregir el otro.

| Archivo | Para qué |
| --- | --- |
| `CLAUDE.md` | El reglamento. Empezá por acá. |
| `DEPLOY.md` | Manual de operaciones del despliegue. |
| `dbnew.md` | Bitácora del backend (historia, no reglas). |
| `Images/islands/ISLAS.md` | Cómo separar una escena en cielo + isla. |
| `Images/islands/BOTONES.md` | Cómo dibujar e importar el botón de nivel de una isla. |
| `Images/islands/FONDOS.md` | Cómo se hace el fondo de la pantalla de juego. |

### El código

- `src/pages/` — el juego: login, mapa de mundos, isla, gameplay, atajos,
  habilidades, logros. Y `src/pages/manage/`, las pantallas de gestión.
- `src/data/` — el currículum: `activities.ts` (los 103 niveles),
  `worlds.ts`, `levelPositions.ts` (dónde va cada nodo en el mapa).
- `src/utils/progress.ts` — progreso local y su sincronización.
- `api/src/routes/` — auth, usuarios, grupos, progreso, importación,
  tableros.
- `api/migrations/` — el esquema. Es la fuente de verdad de la base.
- `public/assets/islands/islandN/` — todo el arte de una isla junto.

Los originales de arte viven en `Images/` e `Images-new/` y **no se
modifican**: las copias web se generan con los scripts de `scripts/`.
