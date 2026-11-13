import assert from "node:assert/strict";
import test from "node:test";
import type { FastifyRequest } from "fastify";
import { cristalesInfinitosLocales } from "./localDevelopment.js";

const env = { ORBITA_CRISTALES_INFINITOS: "true", DATABASE_URL: "postgres://local:local@127.0.0.1:5433/local", NODE_ENV: "development" };
const request = (host = "localhost:3010", remoteAddress = "127.0.0.1", origin?: string) =>
  ({ headers: { host, origin }, socket: { remoteAddress } }) as Pick<FastifyRequest, "headers" | "socket">;

test("requiere opción explícita y no se activa en producción ni con una base remota", () => {
  assert(cristalesInfinitosLocales(request(), env));
  assert(!cristalesInfinitosLocales(request(), { ...env, ORBITA_CRISTALES_INFINITOS: "false" }));
  assert(!cristalesInfinitosLocales(request(), { ...env, ORBITA_CRISTALES_INFINITOS: undefined }));
  assert(!cristalesInfinitosLocales(request(), { ...env, NODE_ENV: "production" }));
  assert(!cristalesInfinitosLocales(request(), { ...env, DATABASE_URL: "postgres://db.example/local" }));
});
test("acepta localhost/IPv4/IPv6, rechaza acceso remoto y orígenes externos", () => {
  assert(cristalesInfinitosLocales(request("127.0.0.1:3010", "::ffff:127.0.0.1", "http://localhost:5210"), env));
  assert(cristalesInfinitosLocales(request("[::1]:3010", "::1", "http://[::1]:5210"), env));
  assert(!cristalesInfinitosLocales(request("typely.becode.com.ar"), env));
  assert(!cristalesInfinitosLocales(request("localhost.evil.test"), env));
  assert(!cristalesInfinitosLocales(request("localhost:3010", "192.168.1.3"), env));
  assert(!cristalesInfinitosLocales(request("localhost:3010", "127.0.0.1", "https://external.test"), env));
  const forwarded = request("localhost:3010", "192.168.1.3");
  forwarded.headers["x-forwarded-for"] = "127.0.0.1";
  assert(!cristalesInfinitosLocales(forwarded, env));
});
