import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { levelPositionsWriter } from "./scripts/vite-plugin-level-positions";

export default defineConfig(({ mode }) => {
  /* Prefijo vacío: `loadEnv` normalmente solo expone las `VITE_*`, y esta
     variable NO tiene que llegar al bundle — se usa acá, en Node, para
     decidir a dónde apunta el proxy de desarrollo. */
  const env = loadEnv(mode, process.cwd(), "");

  /* A dónde va `/api` mientras desarrollás. Por defecto, la API de
     producción, que es lo que sirve para trabajar en el juego sin montar
     nada. Para levantar todo el stack local poné en `.env.local`:

       TYPELY_API=http://127.0.0.1:3000

     Es una variable y no una edición de este archivo a propósito: editarlo
     terminaba commiteado por accidente y le cambiaba el backend a todo el
     equipo. `.env.local` está en `.gitignore`. */
  const apiTarget = env.TYPELY_API || "https://typely.becode.com.ar";

  return {
    /* levelPositionsWriter sólo corre en `vite dev` (apply: "serve"): le da
       al editor visual de niveles un endpoint para escribir
       levelPositions.ts directo, sin copiar y pegar. No existe en el build
       de producción. */
    plugins: [react(), tailwindcss(), levelPositionsWriter()],
    server: {
      /* El proxy mantiene al navegador en un solo origen, así no hay CORS
         ni cookies cross-site — y la cookie de refresh, que es HTTP-only,
         viaja igual que en producción. */
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: apiTarget.startsWith("https:"),
        },
      },
    },
    build: {
      // Source maps publicados para debugging en producción (Lighthouse
      // "Buenas prácticas"). No exponen secretos: el frontend es público.
      sourcemap: true,
    },
  };
});
