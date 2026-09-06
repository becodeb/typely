import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/* =====================================================================
   PLUGIN DE DESARROLLO — guardar los adornos de esquina del login
   ---------------------------------------------------------------------
   Expone POST /__typely/login-esquinas SOLO en el servidor de desarrollo
   (`apply: "serve"`), para que el editor visual del login escriba directo
   en src/data/loginEsquinas.ts. Mismo contrato que el de las posiciones
   de nivel: nunca llega a producción.

   Cuerpo esperado:
     { "esquinas": { "ai": { "x": -5.9, "y": -5.9, "ancho": 35.2, "giro": 0 }, "ad": …, "bd": …, "bi": … } }

   Reescribe sólo las cuatro líneas del objeto `LOGIN_ESQUINAS`; el bloque
   de comentario que explica las unidades queda intacto.
===================================================================== */

const FILE = "src/data/loginEsquinas.ts";
const ENDPOINT = "/__typely/login-esquinas";
const CLAVES = ["ai", "ad", "bd", "bi"] as const;
const ETIQUETA: Record<(typeof CLAVES)[number], string> = {
  ai: "arriba izquierda",
  ad: "arriba derecha",
  bd: "abajo derecha",
  bi: "abajo izquierda",
};

type Esquina = { x: number; y: number; ancho: number; giro: number };

const esNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const r1 = (v: number) => Math.round(v * 10) / 10;

export function loginEsquinasWriter(): Plugin {
  return {
    name: "typely-login-esquinas-writer",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(ENDPOINT, (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("solo POST");
          return;
        }
        let raw = "";
        req.on("data", (c) => {
          raw += c;
          if (raw.length > 20_000) req.destroy();
        });
        req.on("end", () => {
          const reply = (code: number, payload: unknown) => {
            res.statusCode = code;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(payload));
          };
          try {
            const { esquinas } = JSON.parse(raw) as { esquinas: Record<string, Esquina> };
            if (!esquinas || typeof esquinas !== "object") return reply(400, { error: "esquinas vacío" });
            for (const k of CLAVES) {
              const e = esquinas[k];
              if (!e || !esNum(e.x) || !esNum(e.y) || !esNum(e.ancho) || !esNum(e.giro)) {
                return reply(400, { error: `${k}: valores no numéricos` });
              }
              /* Más de un ancho de tarjeta hacia afuera ya no es un adorno de
                 esquina, es un error de tipeo. */
              if (e.x < -100 || e.x > 100 || e.y < -100 || e.y > 100) return reply(400, { error: `${k}: x/y fuera de rango` });
              if (e.ancho <= 0 || e.ancho > 100) return reply(400, { error: `${k}: ancho fuera de rango` });
              if (e.giro < -180 || e.giro > 180) return reply(400, { error: `${k}: giro fuera de rango` });
            }

            const file = path.resolve(server.config.root, FILE);
            const src = fs.readFileSync(file, "utf8");
            const marca = "export const LOGIN_ESQUINAS";
            const open = src.indexOf(marca);
            if (open < 0) return reply(404, { error: `no encontré LOGIN_ESQUINAS en ${FILE}` });
            const bodyStart = src.indexOf("{", open) + 1;
            const bodyEnd = src.indexOf("\n};", bodyStart);
            if (bodyEnd < 0) return reply(500, { error: "no encontré el cierre del objeto" });

            const lines = CLAVES.map((k) => {
              const e = esquinas[k];
              return `  ${k}: { x: ${r1(e.x)}, y: ${r1(e.y)}, ancho: ${r1(e.ancho)}, giro: ${r1(e.giro)} },   // ${ETIQUETA[k]}`;
            });
            const next = src.slice(0, bodyStart) + "\n" + lines.join("\n") + src.slice(bodyEnd);
            fs.writeFileSync(file, next, "utf8");
            server.config.logger.info(`[typely] esquinas del login guardadas en ${FILE}`);
            reply(200, { ok: true, written: lines.join("\n") });
          } catch (err) {
            reply(500, { error: String((err as Error)?.message ?? err) });
          }
        });
      });
    },
  };
}
