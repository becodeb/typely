/* Levanta la base de desarrollo y crea el superadmin local.
 *
 *   node scripts/local-db.mjs           arranca (o reusa) el contenedor
 *   node scripts/local-db.mjs --reset   lo borra y empieza de cero
 *
 * Existe porque "levantá un Postgres y pasale la URL" es exactamente el
 * paso donde se pierde media hora: puerto ocupado, contenedor a medio
 * arrancar, migraciones contra una base que todavía no acepta conexiones.
 * Acá eso está resuelto y verificado antes de seguir.
 *
 * La base es DESCARTABLE y vive solo en tu máquina. Sus credenciales
 * (`api/.env`, ignorado por git) no son secretos de producción: nunca hay
 * que copiar los de Coolify acá.
 *
 * Puerto 5433 y no 5432 a propósito, para no chocar con un Postgres que ya
 * tengas instalado — el choque se manifiesta como "la contraseña no anda",
 * que manda a buscar el problema al lugar equivocado.
 */

import { spawnSync } from "node:child_process";

import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CONTAINER = "typely-pg";
const IMAGE = "postgres:16-alpine";
const PORT = 5433;
const DB = { user: "typely", pass: "typely", name: "typely" };

const reset = process.argv.includes("--reset");

function sh(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", ...opts });
}
function docker(args, opts = {}) {
  return sh("docker", args, opts);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function requireDocker() {
  const r = docker(["info", "--format", "{{.ServerVersion}}"]);
  if (r.status !== 0) {
    console.error("\n✖ El demonio de Docker no responde.");
    console.error("  Abrí Docker Desktop y esperá a que diga «Engine running».\n");
    process.exit(1);
  }
  console.log(`Docker ${r.stdout.trim()} ✓`);
}

function startContainer() {
  const existing = docker([
    "ps", "-a", "--filter", `name=^${CONTAINER}$`, "--format", "{{.State}}",
  ]).stdout.trim();

  if (existing && reset) {
    console.log("Borrando el contenedor anterior (--reset)…");
    docker(["rm", "-f", CONTAINER]);
  } else if (existing === "running") {
    console.log(`Contenedor "${CONTAINER}" ya andando ✓`);
    return;
  } else if (existing) {
    console.log(`Arrancando el contenedor "${CONTAINER}" que ya existía…`);
    const r = docker(["start", CONTAINER]);
    if (r.status !== 0) {
      console.error(r.stderr);
      process.exit(1);
    }
    return;
  }

  console.log(`Creando "${CONTAINER}" (${IMAGE}) en el puerto ${PORT}…`);
  const r = docker([
    "run", "-d",
    "--name", CONTAINER,
    /* Solo loopback: la base de desarrollo no se expone a la red de nadie. */
    "-p", `127.0.0.1:${PORT}:5432`,
    "-e", `POSTGRES_USER=${DB.user}`,
    "-e", `POSTGRES_PASSWORD=${DB.pass}`,
    "-e", `POSTGRES_DB=${DB.name}`,
    IMAGE,
  ]);
  if (r.status !== 0) {
    console.error(r.stderr.trim());
    if (/port is already allocated/i.test(r.stderr)) {
      console.error(`\n  Algo más está usando el puerto ${PORT}. Liberalo o cambiá el puerto acá y en api/.env.`);
    }
    process.exit(1);
  }
}

/** Postgres acepta conexiones bastante después de que el contenedor "corre".
 *  Migrar antes de eso falla con un error de red que no dice nada útil. */
async function waitReady() {
  process.stdout.write("Esperando a que Postgres acepte conexiones");
  for (let i = 0; i < 60; i++) {
    const r = docker(["exec", CONTAINER, "pg_isready", "-U", DB.user, "-d", DB.name]);
    if (r.status === 0) {
      console.log(" ✓");
      return;
    }
    process.stdout.write(".");
    await wait(1000);
  }
  console.error("\n✖ No respondió en 60s. Mirá: docker logs " + CONTAINER);
  process.exit(1);
}

/** Corre un script de la API invocando `node` directo, sin pasar por npm.
 *
 *  Las dos formas obvias fallan en Windows. Con `shell: true`, Node
 *  concatena los argumentos sin escaparlos y avisa (DEP0190). Sin shell y
 *  nombrando `npm.cmd`, Node directamente se niega a ejecutar un `.cmd`
 *  —endurecimiento por CVE-2024-27980—, el hijo nunca arranca y el fallo
 *  es mudo: `status` viene en null y no se imprime una sola línea.
 *
 *  `process.execPath` es el mismo Node que corre este script, así que no
 *  hay resolución de PATH que pueda fallar. Es el mismo comando que
 *  envuelven los scripts de `api/package.json`, que siguen siendo la
 *  entrada para usarlos a mano. */
function apiScript(file) {
  const r = spawnSync(
    process.execPath,
    ["--env-file=.env", "--import", "tsx", `./src/scripts/${file}`],
    { cwd: `${ROOT}api`, stdio: "inherit" },
  );
  if (r.error) {
    console.error(`\n✖ No se pudo correr ${file}: ${r.error.message}`);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}

/** Las migraciones las aplica cada script al arrancar, así que estos dos
 *  pasos dejan la base con esquema, con el superadmin y con las cuentas de
 *  prueba. El seed corre SIEMPRE, no solo al crear la base: es idempotente
 *  y así las ocho cuentas siguen ahí aunque hayas cambiado alguna probando. */
function bootstrap() {
  console.log("\nAplicando migraciones y creando el superadmin…");
  apiScript("bootstrap.ts");
  console.log("\nSembrando las cuentas de prueba…");
  apiScript("seed-local.ts");
}

/* Las cuentas las imprime el seed, que es quien las decide. Repetirlas acá
   sería una segunda copia que se desincroniza el día que cambie una. */
function nextSteps() {
  console.log("Falta levantar los dos servidores, cada uno en su terminal:");
  console.log("   cd api && npm run dev:local");
  console.log("   npm run dev");
  console.log("\nDespués entrás en http://localhost:5173\n");
}

requireDocker();
startContainer();
await waitReady();
bootstrap();
nextSteps();

