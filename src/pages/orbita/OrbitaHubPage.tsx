/* El hub de Órbita — la estación desde la que se despega.
 *
 * Fondo de espacio (las mismas capas del juego, con tinte quieto y el
 * horizonte de las islas abajo), la ESTACIÓN ORBITAL con la nave del chico
 * apoyada en su plataforma, y tres puertas: jugar, ranking y hangar. Es
 * una isla más, la que quedó en órbita: el mismo cuento de las islas, de
 * noche. Acá también vive el ONBOARDING DEL ALIAS: la primera vez que un
 * alumno real entra, elige su nombre de piloto con la nave de fondo — es
 * parte de la ficción, no un formulario. El demo juega sin alias y sin
 * ranking.
 *
 * La estación es una imagen generada aparte (ORBITA.md §7.2). Hasta que
 * exista, el aro de luz de la plataforma sostiene solo a la nave.
 */
import { ArrowLeft, Play, Rocket, Trophy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CharacterSkin } from "../../components/common/CharacterSkin";
import { Gema, InsigniaRango } from "../../components/orbita/OrbitaIconos";
import { colorEstela } from "../../data/orbitaCosmeticos";
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

const ocultarSiFalta = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = "none";
};

/** El horizonte y su capa de tinte se ocultan JUNTOS: la de tinte sin
 *  máscara sería un rectángulo de color tapando la pantalla. */
const ocultarHorizonte = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = "none";
  e.currentTarget.nextElementSibling?.setAttribute("style", "display:none");
};

/** Las capas del juego con el tinte quieto en pervinca: el hub es la calma
 *  antes de la tormenta. Lo comparten el ranking y el hangar. */
export function FondoEspacio({
  tinte = "rgb(84, 112, 224)",
  fuerza = 0.55,
}: {
  tinte?: string;
  fuerza?: number;
}) {
  return (
    <div
      className="orb-fondo"
      style={
        {
          "--orb-nebulosa": "url(/assets/orbita/fondo/nebulosa.webp)",
          "--orb-horizonte": "url(/assets/orbita/fondo/horizonte.webp)",
          "--orb-tinte": tinte,
          "--orb-tinte-fuerza": fuerza,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <img className="orb-estrellas" src="/assets/orbita/fondo/estrellas.webp" alt="" />
      <div className="orb-tinte" />
      <img
        className="orb-horizonte orb-horizonte--quieto"
        src="/assets/orbita/fondo/horizonte.webp"
        alt=""
        onError={ocultarHorizonte}
      />
      <div className="orb-horizonte-tinte orb-horizonte-tinte--quieto" />
      <img className="orb-polvo" src="/assets/orbita/fondo/polvo.webp" alt="" />
    </div>
  );
}

/** La estación con la nave apoyada. `estela` es el color de la estela
 *  equipada (o null). Lo comparten el hub y el hangar. */
export function Puerto({ estela, className }: { estela: string | null; className?: string }) {
  /* Sin estación, la nave necesita algo donde posarse: un aro de luz. Con
     la estación puesta sobra, porque su plataforma ya lo trae pintado. */
  const [hayEstacion, setHayEstacion] = useState(true);
  return (
    <div
      className={`orb-puerto ${hayEstacion ? "" : "orb-puerto--sin-estacion"} ${className ?? ""}`}
    >
      {hayEstacion ? (
        <img
          className="orb-estacion"
          src="/assets/orbita/hub/estacion.webp"
          alt=""
          onError={() => setHayEstacion(false)}
        />
      ) : (
        <span className="orb-plataforma" aria-hidden="true" />
      )}
      <div className="orb-puerto__nave">
        {estela && (
          <span
            className="orb-estela"
            style={{ "--orb-estela-color": estela } as React.CSSProperties}
          />
        )}
        <CharacterSkin kind="ship" className="block w-full orb-flota-a" alt="Tu nave" />
      </div>
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
  const estela = colorEstela(perfil?.equipped.trail);

  return (
    <main className="relative min-h-dvh overflow-hidden" aria-label="Modo Órbita">
      <FondoEspacio />

      <div className="relative z-10 min-h-dvh grid content-center justify-items-center gap-5 px-4 py-8">
        <button
          type="button"
          onClick={() => navigate("/modos")}
          className="orb-pildora orb-pildora--boton fixed top-4 left-4 z-20 text-sm"
        >
          <ArrowLeft size={17} /> Modos
        </button>

        <header className="text-center grid gap-0.5 justify-items-center">
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

        {/* La estación, con la nave apoyada y sus datos en píldoras de vidrio. */}
        <div className="grid justify-items-center gap-2">
          <Puerto estela={estela} />
          <div className="flex items-center gap-2.5 flex-wrap justify-center">
            <span className="orb-pildora">
              <Gema nombre="cristal" className="w-5 h-5" />
              {perfil?.crystals ?? 0} cristales
            </span>
            {mejor > 0 && (
              <span className="orb-pildora">
                <InsigniaRango rango={rango.id} className="w-6 h-6" />
                récord {mejor.toLocaleString("es-AR")} · {rango.nombre}
              </span>
            )}
          </div>
        </div>

        {/* Las tres puertas. */}
        <div className="grid gap-3 w-[min(26rem,92vw)]">
          <Link to="/orbita/tormenta" className="orb-boton-primario text-xl py-4">
            <Play size={24} /> Tormenta de palabras
          </Link>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/orbita/ranking" className="orb-boton-vidrio">
              <Trophy size={19} /> Ranking
            </Link>
            <Link to="/orbita/hangar" className="orb-boton-vidrio">
              <Rocket size={19} /> Hangar
            </Link>
          </div>
        </div>

        {!sincroniza && (
          <p className="orb-dato m-0 text-sm opacity-90 text-center max-w-md font-semibold">
            Estás jugando de prueba: tus partidas quedan en esta compu y no entran al ranking.
          </p>
        )}
      </div>

      {/* Onboarding del alias — con la nave de fondo, parte de la ficción. */}
      {pideAlias && (
        <div
          className="fixed inset-0 z-30 grid place-items-center p-4"
          style={{ background: "rgba(20, 27, 77, 0.6)" }}
        >
          <section
            className="orb-vidrio w-[min(26rem,94vw)] p-6 grid gap-4 text-center"
            aria-label="Elegí tu nombre de piloto"
          >
            <h2 className="m-0 font-extrabold text-2xl" style={{ fontFamily: "var(--font-display)" }}>
              ¿Cómo te llamás, piloto?
            </h2>
            <p className="orb-suave m-0 text-sm font-semibold">
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
              className="orb-campo text-center"
              autoFocus
            />
            {errorAlias && (
              <p className="m-0 text-sm font-bold" style={{ color: "#d64a6a" }}>
                {errorAlias}
              </p>
            )}
            <button
              type="button"
              disabled={guardando || alias.trim().length < 3}
              onClick={() => void guardarAlias()}
              className="orb-boton-primario"
            >
              {guardando ? "Guardando…" : "¡Listo para despegar!"}
            </button>
            <p className="orb-suave m-0 text-xs font-semibold">
              Después lo podés cambiar en el hangar, una vez por semana.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}

export default OrbitaHubPage;
