import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { levelPositionsWriter } from "./scripts/vite-plugin-level-positions";

export default defineConfig({
  /* levelPositionsWriter sólo corre en `vite dev` (apply: "serve"): le da al
     editor visual de niveles un endpoint para escribir levelPositions.ts
     directo, sin copiar y pegar. No existe en el build de producción. */
  plugins: [react(), tailwindcss(), levelPositionsWriter()],
  server: {
    /* Solo en dev: `/api` va a la API de producción. Deja al navegador en
       el mismo origen, así no hay CORS ni cookies cross-site, y el
       frontend local trabaja contra la base real.

       Apuntaba a `typely.bauhub.online` con un comentario sobre Supabase:
       las dos cosas quedaron viejas —hoy corre en Coolify contra un
       Postgres propio— y el proxy no llegaba a ningún lado.

       Para trabajar contra una API local, cambiá el target a
       `http://127.0.0.1:3000` y no lo commitees. */
    proxy: {
      "/api": {
        target: "https://typely.becode.com.ar",
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    // Source maps publicados para debugging en producción (Lighthouse
    // "Buenas prácticas"). No exponen secretos: el frontend es público.
    sourcemap: true,
  },
});
