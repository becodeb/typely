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
 */
import { ArrowLeft, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CharacterSkin } from "../../components/common/CharacterSkin";
import { IconoOrbita } from "../../components/orbita/OrbitaIconos";
import { COSMETICOS, colorEstela, type Cosmetico } from "../../data/orbitaCosmeticos";
import { useAuth } from "../../hooks/useAuth";
import { api, ApiError, type ArcadePerfil } from "../../utils/api";
import {
  actualizarPerfilLocal,
  hidratarPerfil,
  sincronizaArcade,
} from "../../utils/orbita/arcade";

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
      <div
        className="orb-fondo"
        style={
          {
            "--orb-nebulosa": "url(/assets/orbita/fondo/nebulosa.webp)",
            "--orb-tinte": "rgb(70, 110, 200)",
            "--orb-tinte-fuerza": 0.45,
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

        <header className="text-center mt-8 grid gap-1 justify-items-center">
          <h1
            className="orb-dato m-0 font-extrabold"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem, 5vw, 2.6rem)" }}
          >
            Hangar
          </h1>
          <span className="orb-dato font-bold flex items-center gap-1.5">
            <IconoOrbita nombre="cristal" className="w-5 h-5" style={{ color: "#9b7cff" }} />
            {perfil?.crystals ?? 0} cristales
          </span>
        </header>

        {/* La nave con la estela puesta — se prueba acá mismo. */}
        <div className="relative w-[min(24vh,11rem)]">
          {estela && (
            <span
              className="orb-estela"
              style={{ "--orb-estela-color": estela } as React.CSSProperties}
            />
          )}
          <CharacterSkin kind="ship" className="block w-full orb-flota-a" alt="Tu nave" />
        </div>

        {/* Alias */}
        {sincroniza && (
          <section
            className="w-[min(30rem,94vw)] rounded-[22px] px-4 py-3 flex items-center gap-3 flex-wrap"
            style={{
              background: "rgba(16, 26, 56, 0.85)",
              border: "1px solid rgba(148, 178, 226, 0.25)",
              color: "#eef4ff",
            }}
          >
            <span className="text-sm opacity-75">Nombre de piloto</span>
            {editandoAlias ? (
              <>
                <input
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void guardarAlias();
                  }}
                  maxLength={16}
                  className="flex-1 min-w-32 px-3 py-1.5 rounded-xl border font-bold"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    borderColor: "rgba(148,178,226,0.35)",
                    color: "#eef4ff",
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  disabled={ocupado === "alias"}
                  onClick={() => void guardarAlias()}
                  className="px-3 py-1.5 rounded-xl border-0 cursor-pointer font-bold text-sm text-[#0b2437]"
                  style={{ background: "linear-gradient(90deg, #54e8c6, #25c8df)" }}
                >
                  Guardar
                </button>
              </>
            ) : (
              <>
                <b className="flex-1" style={{ fontFamily: "var(--font-display)" }}>
                  {perfil?.alias ?? "sin alias"}
                </b>
                <button
                  type="button"
                  onClick={() => {
                    setAlias(perfil?.alias ?? "");
                    setEditandoAlias(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border-0 cursor-pointer font-bold text-sm text-inherit transition-colors"
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
                className="rounded-[20px] px-4 py-3 flex items-center gap-3"
                style={{
                  background: "rgba(16, 26, 56, 0.85)",
                  border: `1px solid ${puesto ? "rgba(84,232,198,0.6)" : "rgba(148,178,226,0.25)"}`,
                  color: "#eef4ff",
                }}
              >
                <span
                  className="w-9 h-9 rounded-full flex-none"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, #ffffff33, ${item.color})`,
                    boxShadow: `0 0 14px ${item.color}66`,
                  }}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <b className="block truncate" style={{ fontFamily: "var(--font-display)" }}>
                    {item.nombre}
                  </b>
                  <span className="text-xs opacity-70 flex items-center gap-1">
                    {tiene ? (
                      puesto ? "puesta" : "en el hangar"
                    ) : (
                      <>
                        <IconoOrbita nombre="cristal" className="w-3.5 h-3.5" style={{ color: "#9b7cff" }} />
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
                      className="px-3 py-1.5 rounded-xl border-0 cursor-pointer font-bold text-sm transition-colors"
                      style={
                        puesto
                          ? { background: "rgba(84,232,198,0.2)", color: "#5be8ba" }
                          : { background: "rgba(255,255,255,0.12)", color: "#eef4ff" }
                      }
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
                      className="px-3 py-1.5 rounded-xl border-0 cursor-pointer font-bold text-sm text-[#0b2437] disabled:opacity-40"
                      style={{ background: "linear-gradient(90deg, #54e8c6, #25c8df)" }}
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
          <p className="orb-dato m-0 text-sm opacity-80 text-center max-w-md">
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
