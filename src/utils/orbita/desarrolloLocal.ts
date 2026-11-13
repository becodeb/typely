import type { ArcadePerfil } from "../api";

export function esOrbitaLocal(): boolean {
  return import.meta.env.DEV && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
}
export function cristalesInfinitosDemo(): boolean {
  return esOrbitaLocal() && import.meta.env.VITE_ORBITA_CRISTALES_INFINITOS === "true";
}
export function tieneCristalesInfinitos(perfil: ArcadePerfil | null): boolean {
  return esOrbitaLocal() && perfil?.crystalsInfinite === true;
}
