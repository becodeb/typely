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
import { readFileSync } from "node:fs";
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

/** Las migraciones las aplica el propio bootstrap al arrancar, así que este
 *  paso deja la base con esquema Y con el superadmin, de una. */
function bootstrap() {
  console.log("\nAplicando migraciones y creando el superadmin…");
  /* `npm.cmd` en vez de `shell: true`: con shell, Node concatena los
     argumentos sin escaparlos y avisa (DEP0190). Nombrar el ejecutable
     real de Windows evita el shell y la advertencia. */
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const r = spawnSync(npm, ["run", "bootstrap:local"], {
    cwd: `${ROOT}api`,
    stdio: "inherit",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function credentials() {
  /* Se leen del .env en vez de repetirlas acá: una copia se desincroniza
     el día que alguien cambia una y no la otra. */
  const env = Object.fromEntries(
    readFileSync(`${ROOT}api/.env`, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
      }),
  );
  console.log("\n────────────────────────────────────────────");
  console.log(" Entrás en http://localhost:5173 con:");
  console.log(`   usuario:     ${env.SUPERADMIN_USERNAME}`);
  console.log(`   contraseña:  ${env.SUPERADMIN_PASSWORD}`);
  console.log("────────────────────────────────────────────");
  console.log("\nFalta levantar los dos servidores, cada uno en su terminal:");
  console.log("   cd api && npm run dev:local");
  console.log("   npm run dev");
  console.log("");
}

requireDocker();
startContainer();
await waitReady();
bootstrap();
credentials();

