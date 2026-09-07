/* Inicio de Órbita: la nave equipada en vuelo, sobre su propio horizonte.
 * Conserva el perfil, el alias y las entradas a juego, ranking y tienda. */
import { ArrowLeft, Play, Rocket, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { NaveOrbita } from "../../components/orbita/NaveOrbita";
import { MascotaOrbita } from "../../components/orbita/MascotaOrbita";
import { navePorId } from "../../data/orbitaNaves";
import { Gema, InsigniaRango } from "../../components/orbita/OrbitaIconos";
import { colorEstela, efectoCosmetico } from "../../data/orbitaCosmeticos";
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
import { tieneCristalesInfinitos } from "../../utils/orbita/desarrolloLocal";

/** El horizonte y su capa de tinte se ocultan JUNTOS: la de tinte sin
 *  máscara sería un rectángulo de color tapando la pantalla. */
const ocultarHorizonte = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = "none";
  e.currentTarget.nextElementSibling?.setAttribute("style", "display:none");
};

/** Fondo compartido por ranking y tienda. El inicio tiene su propia escena. */
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

/** Todos los modelos usan los mismos anclajes y motores que en la partida. */
function EscenaVuelo({ perfil, destinoMensaje }: { perfil: ArcadePerfil | null; destinoMensaje: React.RefObject<HTMLDivElement | null> }) {
  const nave = navePorId(perfil?.equipped.ship);
  const raiz = useRef<HTMLElement>(null);
  useEffect(() => {
    const sincronizar = () => { if (raiz.current) raiz.current.dataset.oculta = String(document.hidden); };
    sincronizar();
    document.addEventListener("visibilitychange", sincronizar);
    return () => document.removeEventListener("visibilitychange", sincronizar);
  }, []);
  return (
    <figure ref={raiz} className="orb-vuelo" aria-label="Tu nave lista para despegar">
      <div className="orb-vuelo__luz" aria-hidden="true" />
      <div className="orb-vuelo__particulas" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => <i key={i} style={{ "--i": i } as React.CSSProperties} />)}
      </div>
      <div className="orb-vuelo__escuadra" data-acompanada={!!perfil?.equipped.pet}>
        <div className="orb-vuelo__nave">
          <NaveOrbita nave={nave} colorMotor={colorEstela(perfil?.equipped.trail)} efectoEstela={efectoCosmetico(perfil?.equipped.trail)} />
          <MascotaOrbita id={perfil?.equipped.pet} destinoMensaje={destinoMensaje} />
        </div>
      </div>
    </figure>
  );
}

export function OrbitaHubPage() {
  const vozMascota = useRef<HTMLDivElement>(null);
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
    <main className="orb-hub relative min-h-dvh overflow-hidden" aria-label="Modo Órbita">
      <div className="orb-hub__fondo" aria-hidden="true" />

      <div className="orb-hub__contenido">
        <button
          type="button"
          onClick={() => navigate("/modos")}
          className="orb-pildora orb-pildora--boton fixed top-4 left-4 z-20 text-sm"
        >
          <ArrowLeft size={17} /> Modos
        </button>

        <header className="orb-hub__titulo text-center grid gap-0.5 justify-items-center">
          <h1
            className="orb-dato m-0 font-extrabold"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(3rem, 7vw, 4.6rem)" }}
          >
            Órbita
          </h1>
          <div ref={vozMascota} className="orb-hub__saludo" />
        </header>

        {/* La nave y su acompañante comparten el vuelo, sin una plataforma. */}
        <div className="orb-hub__escena">
          <EscenaVuelo perfil={perfil} destinoMensaje={vozMascota} />
          <div className="orb-hub__datos flex items-center gap-2.5 flex-wrap justify-center">
            <span className="orb-pildora">
              <Gema nombre="cristal" className="w-5 h-5" />
              {tieneCristalesInfinitos(perfil) ? "∞" : perfil?.crystals ?? 0} cristales
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
        <div className="orb-hub__acciones grid gap-3 w-[min(26rem,92vw)]">
          <Link to="/orbita/tormenta" className="orb-boton-primario text-xl py-4">
            <Play size={24} /> Tormenta de palabras
          </Link>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/orbita/ranking" className="orb-boton-vidrio">
              <Trophy size={19} /> Ranking
            </Link>
            <Link to="/orbita/tienda" className="orb-boton-vidrio">
              <Rocket size={19} /> Tienda
            </Link>
          </div>
        </div>

        {!sincroniza && (
          <p className="orb-hub__demo orb-dato m-0 text-sm text-center max-w-md font-semibold">
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
            className="orb-vidrio tarjeta-marca w-[min(26rem,94vw)] p-6 grid gap-4 text-center"
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
              Después lo podés cambiar en la tienda, una vez por semana.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}

export default OrbitaHubPage;
