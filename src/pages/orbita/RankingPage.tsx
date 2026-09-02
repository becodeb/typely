/* Ranking de Órbita — semanal por defecto, con el histórico al lado.
 *
 * Tres alcances: global (todo TYPELY), escuela (su sede) y grado (su año,
 * cruzando escuelas). El chico se ve resaltado aunque esté en el puesto
 * 340 — la fila propia SIEMPRE aparece, arriba o abajo de la tabla.
 *
 * El reinicio semanal es la decisión pedagógica: con un ranking eterno,
 * el que empieza en agosto ve que nunca alcanza al de marzo y deja de
 * intentar. Todos los lunes hay una chance real.
 */
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InsigniaRango } from "../../components/orbita/OrbitaIconos";
import { useAuth } from "../../hooks/useAuth";
import { api, ApiError, type ArcadeBoardRow } from "../../utils/api";
import { sincronizaArcade } from "../../utils/orbita/arcade";
import type { RangoId } from "../../utils/orbita/motor";

type Alcance = "global" | "sede" | "grade";
type Periodo = "week" | "all";

const ALCANCES: { id: Alcance; nombre: string }[] = [
  { id: "global", nombre: "Global" },
  { id: "sede", nombre: "Mi escuela" },
  { id: "grade", nombre: "Mi grado" },
];

export function RankingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const sincroniza = sincronizaArcade(user?.role);

  const [alcance, setAlcance] = useState<Alcance>("global");
  const [periodo, setPeriodo] = useState<Periodo>("week");
  const [filas, setFilas] = useState<ArcadeBoardRow[]>([]);
  const [yo, setYo] = useState<{ pos: number; score: number } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sincroniza) return;
    let cancelado = false;
    setCargando(true);
    setError("");
    void api
      .arcadeLeaderboard({ scope: alcance, period: periodo })
      .then((res) => {
        if (cancelado) return;
        setFilas(res.rows);
        setYo(res.me);
      })
      .catch((err) => {
        if (!cancelado) {
          setError(err instanceof ApiError ? err.message : "No pudimos cargar el ranking.");
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [alcance, periodo, sincroniza]);

  const boton = (activo: boolean) =>
    `px-4 py-2 rounded-full border-0 cursor-pointer font-bold text-sm transition-colors ${
      activo ? "text-[#0b2437]" : "orb-dato bg-white/10 hover:bg-white/20"
    }`;
  const fondoActivo = { background: "linear-gradient(90deg, #54e8c6, #25c8df)" };

  return (
    <main className="relative min-h-dvh overflow-hidden" aria-label="Ranking de Órbita">
      <div
        className="orb-fondo"
        style={
          {
            "--orb-nebulosa": "url(/assets/orbita/fondo/nebulosa.webp)",
            "--orb-tinte": "rgb(80, 84, 214)",
            "--orb-tinte-fuerza": 0.5,
          } as React.CSSProperties
        }
        aria-hidden="true"
      >
        <img className="orb-estrellas" src="/assets/orbita/fondo/estrellas.webp" alt="" />
        <div className="orb-tinte" />
      </div>

      <div className="relative z-10 min-h-dvh px-4 py-8 grid content-start justify-items-center gap-5">
        <button
          type="button"
          onClick={() => navigate("/orbita")}
          className="orb-dato fixed top-4 left-4 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border-0 cursor-pointer font-bold text-sm transition-colors"
        >
          <ArrowLeft size={17} /> Órbita
        </button>

        <header className="text-center mt-8">
          <h1
            className="orb-dato m-0 font-extrabold"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem, 5vw, 2.6rem)" }}
          >
            Ranking
          </h1>
        </header>

        {!sincroniza ? (
          <p className="orb-dato text-center max-w-md font-semibold">
            El ranking es de las cuentas de verdad. Entrá con tu usuario para competir con tu
            escuela, tu grado y todo TYPELY.
          </p>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap justify-center">
              {ALCANCES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={boton(alcance === a.id)}
                  style={alcance === a.id ? fondoActivo : undefined}
                  onClick={() => setAlcance(a.id)}
                >
                  {a.nombre}
                </button>
              ))}
              <span className="w-2" />
              <button
                type="button"
                className={boton(periodo === "week")}
                style={periodo === "week" ? fondoActivo : undefined}
                onClick={() => setPeriodo("week")}
              >
                Esta semana
              </button>
              <button
                type="button"
                className={boton(periodo === "all")}
                style={periodo === "all" ? fondoActivo : undefined}
                onClick={() => setPeriodo("all")}
              >
                Histórico
              </button>
            </div>

            <section
              className="w-[min(34rem,94vw)] rounded-[24px] overflow-hidden"
              style={{
                background: "rgba(16, 26, 56, 0.85)",
                border: "1px solid rgba(148, 178, 226, 0.25)",
                color: "#eef4ff",
              }}
              aria-live="polite"
            >
              {cargando ? (
                <p className="m-0 p-6 text-center opacity-80">Cargando…</p>
              ) : error ? (
                <p className="m-0 p-6 text-center opacity-80">{error}</p>
              ) : filas.length === 0 ? (
                <p className="m-0 p-6 text-center opacity-80">
                  Todavía no hay partidas {periodo === "week" ? "esta semana" : "registradas"}.
                  ¡El primer puesto está esperando!
                </p>
              ) : (
                <ol className="m-0 p-0 list-none">
                  {filas.map((f) => (
                    <li
                      key={f.pos}
                      className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8"
                      style={
                        f.mine
                          ? { background: "rgba(84, 232, 198, 0.14)", borderLeft: "3px solid #54e8c6" }
                          : undefined
                      }
                    >
                      <span
                        className="w-8 text-center font-extrabold tabular-nums"
                        style={{
                          fontFamily: "var(--font-display)",
                          color: f.pos <= 3 ? "#ffd552" : "inherit",
                        }}
                      >
                        {f.pos}
                      </span>
                      <InsigniaRango rango={f.rankId as RangoId} className="w-7 h-7" />
                      <span className="flex-1 font-bold truncate">
                        {f.alias}
                        {f.mine && <span className="opacity-70 font-semibold"> (vos)</span>}
                        {f.realName && (
                          <span className="block text-xs opacity-60 font-normal">{f.realName}</span>
                        )}
                      </span>
                      <span className="text-xs opacity-70 tabular-nums">{f.wpmPeak} PPM</span>
                      <span className="font-extrabold tabular-nums" style={{ color: "#ffd552" }}>
                        {f.score.toLocaleString("es-AR")}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {yo && !filas.some((f) => f.mine) && (
                <p
                  className="m-0 px-4 py-3 text-sm font-bold"
                  style={{ background: "rgba(84, 232, 198, 0.14)" }}
                >
                  Vos: puesto {yo.pos} · {yo.score.toLocaleString("es-AR")} puntos
                </p>
              )}
            </section>

            {periodo === "week" && (
              <p className="orb-dato m-0 text-xs opacity-80">
                El ranking semanal se reinicia todos los lunes. El histórico queda para siempre.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default RankingPage;
