/* Selector de modos — la puerta del alumno después del login.
 *
 * No es un menú: son ORBES DE CRISTAL flotando en el cielo pastel, y a
 * través del vidrio se ve el mundo que cada uno contiene. El de Aventura
 * lleva el archipiélago; el de Órbita, espacio con letras a la deriva; y
 * hay un tercero dormido que dice "el juego va a crecer" sin prometer
 * fecha. Cada modo futuro es un orbe más (una imagen más, no un set:
 * cristal y brillo son compartidos).
 *
 * Si el docente apagó el arcade para su grupo, el orbe de Órbita se ve
 * DORMIDO — nunca desaparece ni queda como botón muerto: al tocarlo
 * cuenta por qué duerme.
 */
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CharacterSkin } from "../../components/common/CharacterSkin";
import { Toast } from "../../components/common/Toast";
import { Orbe } from "../../components/orbita/Orbe";
import { useAuth } from "../../hooks/useAuth";
import { assets } from "../../utils/assets";
import { arcadeHabilitado, loadMyGroup } from "../../utils/userContext";

export function ModosPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mensaje, setMensaje] = useState("");
  const [arcadeOn, setArcadeOn] = useState(() => arcadeHabilitado());

  /* El interruptor del docente vive en la API; se refresca al entrar y la
     pantalla se arma igual con lo último que se supo (sin red no se
     bloquea nada — la misma regla del mapa de mundos). */
  useEffect(() => {
    let cancelado = false;
    void loadMyGroup().then(() => {
      if (!cancelado) setArcadeOn(arcadeHabilitado());
    });
    return () => {
      cancelado = true;
    };
  }, [user?.id]);

  const nombre = user?.name?.split(" ")[0] ?? "piloto";

  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-cover bg-center animate-page-fade"
      style={{ backgroundImage: `url("${assets.homeBg}")` }}
      aria-label="Elegí tu modo de juego"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(51,199,240,0.14), transparent 60%)," +
            "radial-gradient(ellipse 60% 50% at 80% 80%, rgba(156,113,255,0.10), transparent 55%)",
        }}
        aria-hidden="true"
      />

      {/* Salir — arriba a la derecha, discreto. */}
      <button
        type="button"
        onClick={() => {
          logout();
          navigate("/login");
        }}
        className="glass fixed top-4 right-4 z-20 flex items-center gap-2 px-4 py-2 rounded-full border-0 cursor-pointer font-bold text-sm text-text shadow-md hover:scale-105 transition-transform"
      >
        <LogOut size={17} /> Salir
      </button>

      <div className="relative z-10 min-h-dvh grid content-center justify-items-center gap-8 px-4 py-10">
        <header className="text-center grid gap-1 justify-items-center">
          <h1
            className="m-0 font-extrabold"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 5.5vw, 3.2rem)",
              color: "#17355f",
            }}
          >
            ¡Hola, {nombre}!
          </h1>
          <p className="m-0 font-semibold text-lg" style={{ color: "#52658f" }}>
            ¿A qué jugamos hoy?
          </p>
        </header>

        <div className="flex flex-wrap items-start justify-center gap-x-10 gap-y-8">
          <Orbe
            mundo="aventura"
            titulo="Aventura"
            subtitulo="Las islas del recorrido"
            flota="orb-flota-a"
            onEntrar={() => navigate("/mundos")}
          />
          <Orbe
            mundo="orbita"
            titulo="Órbita"
            subtitulo="Minijuegos y ranking"
            flota="orb-flota-b"
            dormido={!arcadeOn}
            motivoDormido="Tu docente pausó este modo"
            onEntrar={() => navigate("/orbita")}
            onDormido={() =>
              setMensaje("Tu docente pausó el modo Órbita por ahora. ¡Seguí con la aventura!")
            }
          />
          <Orbe
            mundo="dormido"
            titulo="???"
            subtitulo=""
            flota="orb-flota-c"
            dormido
            motivoDormido="Muy pronto"
            onDormido={() => setMensaje("Acá va a aparecer un modo nuevo. Todavía está creciendo…")}
          />
        </div>

        {/* La nave del chico acompaña la elección — es un vuelo, no un menú. */}
        <div className="w-[min(30vh,13rem)] pointer-events-none" aria-hidden="true">
          <CharacterSkin kind="ship" className="block w-full orb-flota-a" alt="" />
        </div>
      </div>

      <Toast message={mensaje} />
    </main>
  );
}

export default ModosPage;
