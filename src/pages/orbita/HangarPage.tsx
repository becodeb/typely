/* El hangar — cosméticos y alias.
 *
 * Los cristales compran COSMÉTICOS, nunca ventaja: una estela y un color
 * de rayo no tocan ninguna perilla del motor. La nave base sigue siendo
 * la que el chico se ganó con estrellas en el modo historia (f1…f5): los
 * cristales la VISTEN, no la reemplazan — así los dos modos se alimentan
 * sin que ninguno anule al otro.
 *
 * El precio que vale es el del servidor; este catálogo solo dibuja. En
 * demo el hangar se mira pero no se compra: sin cuenta no hay saldo.
 *
 * Cada cosmético se ve MOVIÉNDOSE en su tarjeta (una miniatura con la
 * nave y la estela latiendo, o el rayo disparándose): son efectos, y un
 * chico tiene que verlos antes de gastar cristales. La nave grande de
 * arriba, apoyada en la estación, lleva puesta la estela equipada: comprar
 * o poner se ve ahí mismo.
 */
import { ArrowLeft, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gema } from "../../components/orbita/OrbitaIconos";
import { COSMETICOS, colorEstela, type Cosmetico } from "../../data/orbitaCosmeticos";
import { useAuth } from "../../hooks/useAuth";
import { api, ApiError, type ArcadePerfil } from "../../utils/api";
import { skinUrl } from "../../utils/assets";
import {
  actualizarPerfilLocal,
  hidratarPerfil,
  sincronizaArcade,
} from "../../utils/orbita/arcade";
import { FondoEspacio, Puerto } from "./OrbitaHubPage";

/** Miniatura viva de un cosmético: la silueta de la nave base con la
 *  estela latiendo debajo, o el rayo disparándose. */
function Miniatura({ item }: { item: Cosmetico }) {
  return (
    <span
      className={`orb-mini ${item.tipo === "estela" ? "orb-mini--estela" : "orb-mini--rayo"}`}
      style={{ "--orb-mini-color": item.color } as React.CSSProperties}
      aria-hidden="true"
    >
      <img src={skinUrl("ship", 0, 0)} alt="" decoding="async" />
    </span>
  );
}

export function HangarPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const sincroniza = sincronizaArcade(user?.role);

  const [perfil, setPerfil] = useState<ArcadePerfil | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [alias, setAlias] = useState("");
  const [editandoAlias, setEditandoAlias] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void hidratarPerfil(user?.role).then((p) => {
      if (!cancelado) setPerfil(p);
    });
    return () => {
      cancelado = true;
    };
  }, [user?.id, user?.role]);

  async function comprar(item: Cosmetico) {
    setOcupado(item.id);
    setMensaje("");
    try {
      const res = await api.buyArcadeItem(item.id);
      const owned = [...(perfil?.owned ?? []), item.id];
      actualizarPerfilLocal({ crystals: res.balance, owned });
      setPerfil((p) => (p ? { ...p, crystals: res.balance, owned } : p));
    } catch (err) {
      setMensaje(err instanceof ApiError ? err.message : "No pudimos completar la compra.");
    } finally {
      setOcupado(null);
    }
  }

  async function equipar(item: Cosmetico, puesto: boolean) {
    const slot = item.tipo === "estela" ? "trail" : "beam";
    const id = puesto ? null : item.id;
    setOcupado(item.id);
    setMensaje("");
    try {
      await api.equipArcadeItem(slot, id);
      const equipped = {
        trail: slot === "trail" ? id : (perfil?.equipped.trail ?? null),
        beam: slot === "beam" ? id : (perfil?.equipped.beam ?? null),
      };
      actualizarPerfilLocal({ equipped });
      setPerfil((p) => (p ? { ...p, equipped } : p));
    } catch (err) {
      setMensaje(err instanceof ApiError ? err.message : "No pudimos equiparlo.");
    } finally {
      setOcupado(null);
    }
  }

  async function guardarAlias() {
    const limpio = alias.trim();
    if (limpio.length < 3) return;
    setOcupado("alias");
    setMensaje("");
    try {
      const res = await api.setArcadeAlias(limpio);
      actualizarPerfilLocal({ alias: res.alias });
      setPerfil((p) => (p ? { ...p, alias: res.alias } : p));
      setEditandoAlias(false);
    } catch (err) {
      setMensaje(err instanceof ApiError ? err.message : "No pudimos cambiar el alias.");
    } finally {
      setOcupado(null);
    }
  }

  const estela = colorEstela(perfil?.equipped.trail);

  return (
    <main className="relative min-h-dvh overflow-hidden" aria-label="Hangar de Órbita">
      <FondoEspacio tinte="rgb(84, 130, 224)" fuerza={0.45} />

      <div className="relative z-10 min-h-dvh px-4 py-8 grid content-start justify-items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/orbita")}
          className="orb-pildora orb-pildora--boton fixed top-4 left-4 z-20 text-sm"
        >
          <ArrowLeft size={17} /> Órbita
        </button>

        <header className="text-center mt-8 grid gap-2 justify-items-center">
          <h1
            className="orb-dato m-0 font-extrabold"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem, 5vw, 2.6rem)" }}
          >
            Hangar
          </h1>
          <span className="orb-pildora">
            <Gema nombre="cristal" className="w-5 h-5" />
            {perfil?.crystals ?? 0} cristales
          </span>
        </header>

        {/* La nave estacionada, con la estela puesta — se prueba acá mismo. */}
        <Puerto estela={estela} className="!w-[min(38vh,26rem,92vw)]" />

        {/* Alias */}
        {sincroniza && (
          <section className="orb-vidrio w-[min(30rem,94vw)] px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="orb-suave text-sm font-semibold">Nombre de piloto</span>
            {editandoAlias ? (
              <>
                <input
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void guardarAlias();
                  }}
                  maxLength={16}
                  className="orb-campo flex-1 min-w-32 !h-11 text-base"
                  autoFocus
                />
                <button
                  type="button"
                  disabled={ocupado === "alias"}
                  onClick={() => void guardarAlias()}
                  className="orb-boton-primario orb-boton--chico"
                >
                  Guardar
                </button>
              </>
            ) : (
              <>
                <b className="flex-1 text-lg" style={{ fontFamily: "var(--font-display)" }}>
                  {perfil?.alias ?? "sin alias"}
                </b>
                <button
                  type="button"
                  onClick={() => {
                    setAlias(perfil?.alias ?? "");
                    setEditandoAlias(true);
                  }}
                  className="orb-boton-vidrio orb-boton--chico"
                >
                  Cambiar
                </button>
              </>
            )}
          </section>
        )}

        {/* Catálogo */}
        <section className="w-[min(34rem,94vw)] grid gap-2.5 grid-cols-1 sm:grid-cols-2">
          {COSMETICOS.map((item) => {
            const tiene = perfil?.owned.includes(item.id) ?? false;
            const puesto =
              (item.tipo === "estela" && perfil?.equipped.trail === item.id) ||
              (item.tipo === "rayo" && perfil?.equipped.beam === item.id);
            const alcanza = (perfil?.crystals ?? 0) >= item.precio;
            return (
              <article
                key={item.id}
                className="orb-vidrio !rounded-[22px] px-3.5 py-3 flex items-center gap-3"
                style={puesto ? { outline: "3px solid rgba(84, 232, 198, 0.8)", outlineOffset: "1px" } : undefined}
              >
                <Miniatura item={item} />
                <div className="flex-1 min-w-0">
                  <b className="block truncate" style={{ fontFamily: "var(--font-display)" }}>
                    {item.nombre}
                  </b>
                  <span className="orb-suave text-xs font-semibold flex items-center gap-1">
                    {tiene ? (
                      puesto ? (
                        "puesta"
                      ) : (
                        "en el hangar"
                      )
                    ) : (
                      <>
                        <Gema nombre="cristal" className="w-4 h-4" />
                        {item.precio}
                      </>
                    )}
                  </span>
                </div>
                {sincroniza ? (
                  tiene ? (
                    <button
                      type="button"
                      disabled={ocupado === item.id}
                      onClick={() => void equipar(item, puesto)}
                      className={`orb-boton--chico ${puesto ? "orb-pildora orb-pildora--boton orb-pildora--activa" : "orb-boton-vidrio"}`}
                    >
                      {puesto ? (
                        <span className="flex items-center gap-1">
                          <Check size={14} /> Puesta
                        </span>
                      ) : (
                        "Poner"
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={ocupado === item.id || !alcanza}
                      onClick={() => void comprar(item)}
                      className="orb-boton-primario orb-boton--chico"
                    >
                      Comprar
                    </button>
                  )
                ) : null}
              </article>
            );
          })}
        </section>

        {!sincroniza && (
          <p className="orb-dato m-0 text-sm opacity-90 text-center max-w-md font-semibold">
            El hangar se abre con una cuenta de verdad: en modo de prueba no hay cristales que
            gastar.
          </p>
        )}
        {mensaje && (
          <p className="orb-dato m-0 text-sm font-bold" style={{ color: "#ffd0da" }} role="alert">
            {mensaje}
          </p>
        )}
      </div>
    </main>
  );
}

export default HangarPage;
