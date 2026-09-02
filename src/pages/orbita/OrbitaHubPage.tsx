/* El hub de Órbita — la estación desde la que se despega.
 *
 * Fondo de espacio (las mismas capas del juego, con tinte quieto), la
 * nave del chico, y tres puertas: jugar, ranking y hangar. Acá también
 * vive el ONBOARDING DEL ALIAS: la primera vez que un alumno real entra,
 * elige su nombre de piloto con la nave de fondo — es parte de la
 * ficción, no un formulario. El demo juega sin alias y sin ranking.
 */
import { ArrowLeft, Play, Rocket, Trophy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CharacterSkin } from "../../components/common/CharacterSkin";
import { IconoOrbita, InsigniaRango } from "../../components/orbita/OrbitaIconos";
import { useAuth } from "../../hooks/useAuth";
import { api, ApiError, type ArcadePerfil } from "../../utils/api";
import {
  actualizarPerfilLocal,
  hidratarPerfil,
  recordLocal,
  sincronizaArcade,
  vaciarColaArcade,
} from "../../utils/orbita/arcade";
import { rangoPorAmenaza, RANGOS } from "../../utils/orbita/motor";

function FondoEspacio() {
  return (
    <div
      className="orb-fondo"
      style={
        {
          "--orb-nebulosa": "url(/assets/orbita/fondo/nebulosa.webp)",
          "--orb-tinte": "rgb(80, 84, 214)",
          "--orb-tinte-fuerza": 0.55,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <img className="orb-estrellas" src="/assets/orbita/fondo/estrellas.webp" alt="" />
      <div className="orb-tinte" />
      <img className="orb-polvo" src="/assets/orbita/fondo/polvo.webp" alt="" />
    </div>
  );
}

export function OrbitaHubPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const sincroniza = sincronizaArcade(user?.role);

  const [perfil, setPerfil] = useState<ArcadePerfil | null>(null);
  const [pideAlias, setPideAlias] = useState(false);
  const [alias, setAlias] = useState("");
  const [errorAlias, setErrorAlias] = useState("");
  const [guardando, setGuardando] = useState(false);

  /* Perfil + cola pendiente, al entrar. Nada bloquea el dibujado. */
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      await vaciarColaArcade(user?.role);
      const p = await hidratarPerfil(user?.role);
      if (cancelado) return;
      setPerfil(p);
      if (sincroniza && p && !p.alias) setPideAlias(true);
    })();
    return () => {
      cancelado = true;
    };
  }, [user?.id, user?.role, sincroniza]);

  const guardarAlias = useCallback(async () => {
    const limpio = alias.trim();
    if (!limpio) return;
    setGuardando(true);
    setErrorAlias("");
    try {
      const res = await api.setArcadeAlias(limpio);
      actualizarPerfilLocal({ alias: res.alias });
      setPerfil((p) => (p ? { ...p, alias: res.alias } : p));
      setPideAlias(false);
    } catch (err) {
      setErrorAlias(err instanceof ApiError ? err.message : "No pudimos guardar el alias.");
    } finally {
      setGuardando(false);
    }
  }, [alias]);

  const record = recordLocal();
  const mejor = perfil?.bestScore || record?.puntaje || 0;
  const rangoId =
    (perfil?.bestRank as (typeof RANGOS)[number]["id"] | null) ??
    (record ? rangoPorAmenaza(record.amenazaMax) : "cadete");
  const rango = RANGOS.find((r) => r.id === rangoId) ?? RANGOS[0]!;

  return (
    <main className="relative min-h-dvh overflow-hidden" aria-label="Modo Órbita">
      <FondoEspacio />

      <div className="relative z-10 min-h-dvh grid content-center justify-items-center gap-7 px-4 py-10">
        <button
          type="button"
          onClick={() => navigate("/modos")}
          className="orb-dato fixed top-4 left-4 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border-0 cursor-pointer font-bold text-sm transition-colors"
        >
          <ArrowLeft size={17} /> Modos
        </button>

        <header className="text-center grid gap-1 justify-items-center">
          <h1
            className="orb-dato m-0 font-extrabold"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.2rem, 6vw, 3.4rem)" }}
          >
            Órbita
          </h1>
          <p className="orb-dato m-0 font-semibold">
            {perfil?.alias ? `Piloto ${perfil.alias}` : "Minijuegos, ranking y hangar"}
          </p>
        </header>

        {/* La nave, con sus datos alrededor como texto suelto. */}
        <div className="grid justify-items-center gap-3">
          <div className="w-[min(26vh,12rem)]">
            <CharacterSkin kind="ship" className="block w-full orb-flota-a" alt="Tu nave" />
          </div>
          <div className="flex items-center gap-5 flex-wrap justify-center">
            <span className="orb-dato font-bold flex items-center gap-1.5">
              <IconoOrbita nombre="cristal" className="w-5 h-5" style={{ color: "#9b7cff" }} />
              {perfil?.crystals ?? 0} cristales
            </span>
            {mejor > 0 && (
              <span className="orb-dato font-bold flex items-center gap-1.5">
                <InsigniaRango rango={rango.id} className="w-6 h-6" />
                récord {mejor.toLocaleString("es-AR")} · {rango.nombre}
              </span>
            )}
          </div>
        </div>

        {/* Las tres puertas. */}
        <div className="grid gap-3 w-[min(26rem,92vw)]">
          <Link
            to="/orbita/tormenta"
            className="flex items-center justify-center gap-3 py-4 rounded-3xl font-extrabold text-xl no-underline text-[#0b2437]"
            style={{
              fontFamily: "var(--font-display)",
              background: "linear-gradient(90deg, #54e8c6, #25c8df, #536bff)",
              boxShadow: "0 14px 30px rgba(35, 190, 210, 0.35)",
            }}
          >
            <Play size={24} /> Tormenta de palabras
          </Link>
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/orbita/ranking"
              className="orb-dato flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/10 hover:bg-white/20 font-bold no-underline transition-colors"
            >
              <Trophy size={19} /> Ranking
            </Link>
            <Link
              to="/orbita/hangar"
              className="orb-dato flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/10 hover:bg-white/20 font-bold no-underline transition-colors"
            >
              <Rocket size={19} /> Hangar
            </Link>
          </div>
        </div>

        {!sincroniza && (
          <p className="orb-dato m-0 text-sm opacity-80 text-center max-w-md">
            Estás jugando de prueba: tus partidas quedan en esta compu y no entran al ranking.
          </p>
        )}
      </div>

      {/* Onboarding del alias — con la nave de fondo, parte de la ficción. */}
      {pideAlias && (
        <div className="fixed inset-0 z-30 grid place-items-center p-4 bg-[rgba(5,10,26,0.75)]">
          <section
            className="w-[min(26rem,94vw)] rounded-[28px] p-6 grid gap-4 text-center"
            style={{
              background: "rgba(16, 26, 56, 0.95)",
              border: "1px solid rgba(148, 178, 226, 0.28)",
              color: "#eef4ff",
            }}
            aria-label="Elegí tu nombre de piloto"
          >
            <h2 className="m-0 font-extrabold text-2xl" style={{ fontFamily: "var(--font-display)" }}>
              ¿Cómo te llamás, piloto?
            </h2>
            <p className="m-0 text-sm opacity-85">
              Este nombre te representa en el ranking de todas las escuelas. No uses tu nombre
              real: inventate uno de piloto.
            </p>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void guardarAlias();
              }}
              maxLength={16}
              placeholder="Cometa Verde"
              className="h-13 px-4 py-3 rounded-2xl border text-lg font-bold text-center"
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                borderColor: "rgba(148, 178, 226, 0.35)",
                color: "#eef4ff",
                fontFamily: "var(--font-display)",
              }}
              autoFocus
            />
            {errorAlias && (
              <p className="m-0 text-sm font-semibold" style={{ color: "#ff9fb4" }}>
                {errorAlias}
              </p>
            )}
            <button
              type="button"
              disabled={guardando || alias.trim().length < 3}
              onClick={() => void guardarAlias()}
              className="py-3 rounded-2xl border-0 cursor-pointer font-bold text-base text-[#0b2437] disabled:opacity-50"
              style={{ background: "linear-gradient(90deg, #54e8c6, #25c8df, #536bff)" }}
            >
              {guardando ? "Guardando…" : "¡Listo para despegar!"}
            </button>
            <p className="m-0 text-xs opacity-60">Después lo podés cambiar en el hangar, una vez por semana.</p>
          </section>
        </div>
      )}
    </main>
  );
}

export default OrbitaHubPage;
