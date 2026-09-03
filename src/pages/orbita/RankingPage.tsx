/* Ranking de Órbita — semanal por defecto, con el histórico al lado.
 *
 * Tres alcances: global (todo TYPELY), escuela (su sede) y grado (su año,
 * cruzando escuelas). El chico se ve resaltado aunque esté en el puesto
 * 340 — la fila propia SIEMPRE aparece, arriba o abajo de la tabla.
 *
 * El reinicio semanal es la decisión pedagógica: con un ranking eterno,
 * el que empieza en agosto ve que nunca alcanza al de marzo y deja de
 * intentar. Todos los lunes hay una chance real.
 *
 * Los tres primeros van en un PODIO con su insignia grande: en primaria un
 * ranking se lee como medallas, no como una tabla. Del cuarto en adelante,
 * la lista, dentro del vidrio de marca.
 */
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InsigniaRango } from "../../components/orbita/OrbitaIconos";
import { useAuth } from "../../hooks/useAuth";
import { api, ApiError, type ArcadeBoardRow } from "../../utils/api";
import { sincronizaArcade } from "../../utils/orbita/arcade";
import type { RangoId } from "../../utils/orbita/motor";
import { FondoEspacio } from "./OrbitaHubPage";

type Alcance = "global" | "sede" | "grade";
type Periodo = "week" | "all";

const ALCANCES: { id: Alcance; nombre: string }[] = [
  { id: "global", nombre: "Global" },
  { id: "sede", nombre: "Mi escuela" },
  { id: "grade", nombre: "Mi grado" },
];

/* Dorado oscuro: el #ffd552 de la paleta no llega a 4.5:1 sobre el vidrio
   claro, y el puntaje es el dato que hay que poder leer. */
const ORO = "#c98a00";

/* Atajo de desarrollo: ?demo=1 llena el ranking con filas de mentira.
   El podio es el único lugar donde las insignias se ven grandes y una al
   lado de la otra, y hasta ahora no había forma de mirarlo sin una cuenta
   de verdad — se revisaba a ciegas. Mismo trato que el ?banda= y el ?bot=
   de la partida: en producción la condición es constante false y el
   bundler se lleva puesto todo esto. */
const FILAS_DEMO: ArcadeBoardRow[] = [
  { pos: 1, alias: "Nova", realName: null, score: 1240, rankId: "leyenda", wpmPeak: 78, mine: false },
  { pos: 2, alias: "Pixel", realName: null, score: 1105, rankId: "capitan", wpmPeak: 71, mine: false },
  { pos: 3, alias: "Kiwi", realName: null, score: 980, rankId: "as", wpmPeak: 66, mine: false },
  { pos: 4, alias: "Tuki", realName: null, score: 812, rankId: "explorador", wpmPeak: 59, mine: true },
  { pos: 5, alias: "Momo", realName: null, score: 640, rankId: "piloto", wpmPeak: 48, mine: false },
  { pos: 6, alias: "Vera", realName: null, score: 410, rankId: "cadete", wpmPeak: 37, mine: false },
];

export function RankingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const demo =
    import.meta.env.DEV && new URLSearchParams(window.location.search).has("demo");
  const sincroniza = demo || sincronizaArcade(user?.role);

  const [alcance, setAlcance] = useState<Alcance>("global");
  const [periodo, setPeriodo] = useState<Periodo>("week");
  const [filas, setFilas] = useState<ArcadeBoardRow[]>([]);
  const [yo, setYo] = useState<{ pos: number; score: number } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (demo) {
      setFilas(FILAS_DEMO);
      setYo({ pos: 4, score: 812 });
      setCargando(false);
      return;
    }
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
  }, [alcance, periodo, sincroniza, demo]);

  const pildora = (activo: boolean) =>
    `orb-pildora orb-pildora--boton text-sm ${activo ? "orb-pildora--activa" : ""}`;

  /* Podio solo cuando hay tres: con menos, la lista alcanza. */
  const conPodio = filas.length >= 3;
  const podio = conPodio ? [filas[1]!, filas[0]!, filas[2]!] : [];
  const resto = conPodio ? filas.slice(3) : filas;

  return (
    <main className="relative min-h-dvh overflow-hidden" aria-label="Ranking de Órbita">
      <FondoEspacio tinte="rgb(112, 96, 230)" fuerza={0.5} />

      <div className="relative z-10 min-h-dvh px-4 py-8 grid content-start justify-items-center gap-5">
        <button
          type="button"
          onClick={() => navigate("/orbita")}
          className="orb-pildora orb-pildora--boton fixed top-4 left-4 z-20 text-sm"
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
          <section className="orb-vidrio w-[min(28rem,94vw)] p-6 text-center grid gap-2">
            <p
              className="m-0 font-bold"
              style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}
            >
              El ranking es de las cuentas de verdad.
            </p>
            <p className="orb-suave m-0 text-sm font-semibold">
              Entrá con tu usuario para competir con tu escuela, tu grado y todo TYPELY.
            </p>
          </section>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap justify-center">
              {ALCANCES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={pildora(alcance === a.id)}
                  onClick={() => setAlcance(a.id)}
                >
                  {a.nombre}
                </button>
              ))}
              <span className="w-2" />
              <button
                type="button"
                className={pildora(periodo === "week")}
                onClick={() => setPeriodo("week")}
              >
                Esta semana
              </button>
              <button
                type="button"
                className={pildora(periodo === "all")}
                onClick={() => setPeriodo("all")}
              >
                Histórico
              </button>
            </div>

            {conPodio && !cargando && !error && (
              <section className="orb-podio w-[min(34rem,94vw)]" aria-label="Los tres primeros">
                {podio.map((f) => (
                  <div
                    key={f.pos}
                    className={`orb-vidrio orb-podio__lugar orb-podio__lugar--${f.pos}`}
                    style={
                      f.mine
                        ? { outline: "3px solid rgba(84, 232, 198, 0.8)", outlineOffset: "2px" }
                        : undefined
                    }
                  >
                    <span className="orb-podio__puesto">
                      {f.pos === 1 ? "1.º puesto" : f.pos === 2 ? "2.º" : "3.º"}
                    </span>
                    <InsigniaRango
                      rango={f.rankId as RangoId}
                      tamano="grande"
                      className={f.pos === 1 ? "w-24 h-24" : "w-16 h-16"}
                    />
                    <b
                      className="block truncate max-w-full"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: f.pos === 1 ? "1.15rem" : "1rem",
                      }}
                    >
                      {f.alias}
                      {f.mine && <span className="orb-suave font-semibold"> (vos)</span>}
                    </b>
                    {f.realName && <span className="orb-suave text-xs font-semibold">{f.realName}</span>}
                    <span
                      className="font-extrabold tabular-nums"
                      style={{
                        color: ORO,
                        fontFamily: "var(--font-display)",
                        fontSize: f.pos === 1 ? "1.4rem" : "1.1rem",
                      }}
                    >
                      {f.score.toLocaleString("es-AR")}
                    </span>
                    <span className="orb-suave text-xs font-semibold tabular-nums">
                      {f.wpmPeak} PPM
                    </span>
                  </div>
                ))}
              </section>
            )}

            <section className="orb-vidrio w-[min(34rem,94vw)] overflow-hidden" aria-live="polite">
              {cargando ? (
                <p className="orb-suave m-0 p-6 text-center font-semibold">Cargando…</p>
              ) : error ? (
                <p className="orb-suave m-0 p-6 text-center font-semibold">{error}</p>
              ) : filas.length === 0 ? (
                <p className="orb-suave m-0 p-6 text-center font-semibold">
                  Todavía no hay partidas {periodo === "week" ? "esta semana" : "registradas"}.
                  ¡El primer puesto está esperando!
                </p>
              ) : resto.length === 0 ? (
                <p className="orb-suave m-0 p-4 text-center text-sm font-semibold">
                  Por ahora son solo los tres del podio. ¡Hay lugar!
                </p>
              ) : (
                <ol className="m-0 p-0 list-none">
                  {resto.map((f) => (
                    <li
                      key={f.pos}
                      className="flex items-center gap-3 px-4 py-2.5"
                      style={{
                        borderBottom: "1px solid rgba(23, 53, 95, 0.1)",
                        ...(f.mine
                          ? { background: "rgba(84, 232, 198, 0.24)", borderLeft: "3px solid #1fb5a6" }
                          : {}),
                      }}
                    >
                      <span
                        className="w-8 text-center font-extrabold tabular-nums"
                        style={{ fontFamily: "var(--font-display)", color: "#52658f" }}
                      >
                        {f.pos}
                      </span>
                      <InsigniaRango rango={f.rankId as RangoId} className="w-7 h-7" />
                      <span
                        className="flex-1 font-bold truncate"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {f.alias}
                        {f.mine && <span className="orb-suave font-semibold"> (vos)</span>}
                        {f.realName && (
                          <span className="orb-suave block text-xs font-medium">{f.realName}</span>
                        )}
                      </span>
                      <span className="orb-suave text-xs font-semibold tabular-nums">
                        {f.wpmPeak} PPM
                      </span>
                      <span
                        className="font-extrabold tabular-nums"
                        style={{ color: ORO, fontFamily: "var(--font-display)" }}
                      >
                        {f.score.toLocaleString("es-AR")}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {yo && !filas.some((f) => f.mine) && (
                <p
                  className="m-0 px-4 py-3 text-sm font-bold"
                  style={{ background: "rgba(84, 232, 198, 0.24)", fontFamily: "var(--font-display)" }}
                >
                  Vos: puesto {yo.pos} · {yo.score.toLocaleString("es-AR")} puntos
                </p>
              )}
            </section>

            {periodo === "week" && (
              <p className="orb-dato m-0 text-xs font-semibold">
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
