import type { FastifyRequest } from "fastify";

const localHost = (host: string) => ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host);
const localUrl = (value: string) => {
  try { return localHost(new URL(value).hostname); } catch { return false; }
};

/** No confía en X-Forwarded-For: el socket y la base deben ser locales. */
export function cristalesInfinitosLocales(
  req: Pick<FastifyRequest, "headers" | "socket">,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NODE_ENV === "production" || env.ORBITA_CRISTALES_INFINITOS !== "true") return false;
  if (!localUrl(env.DATABASE_URL ?? "")) return false;
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "")) return false;
  if (!localUrl("http://" + (req.headers.host ?? ""))) return false;
  for (const origen of [req.headers.origin, req.headers.referer]) {
    if (origen !== undefined && !localUrl(origen)) return false;
  }
  return true;
}
