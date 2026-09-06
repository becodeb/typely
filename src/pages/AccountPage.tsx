import { ArrowLeft, LogOut, Medal, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { StarCounter } from "../components/common/StarCounter";
import { useAuth } from "../hooks/useAuth";
import { assets } from "../utils/assets";
import { getUserContext } from "../utils/userContext";
import { loadProgress } from "../utils/progress";
import { getWorldStatesForUser, getWorldsForUser, worldStarProgress } from "../data/worlds";

/* Misma cáscara que Logros y Misiones: fondo de cielo, cabecera con botón
   de volver y una tarjeta de marca (CLAUDE.md §5). Antes esta pantalla
   usaba clases (`student-soft-page`, `account-card`, …) que ya no existían
   en global.css y se veía sin ningún estilo. */
export function AccountPage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  /* Real progress snapshot — replaces the old hardcoded placeholders so the
     account screen reflects the student's actual adventure. */
  const context = getUserContext(user);
  const progress = loadProgress();
  const visibleWorlds = getWorldsForUser(context, progress);
  const worldStates = getWorldStatesForUser(context, progress);
  const totalStars = visibleWorlds.reduce(
    (sum, w) => sum + worldStarProgress(w.id, progress).earnedStars,
    0,
  );
  const currentWorld =
    visibleWorlds.find((w) => worldStates[w.slug] === "current") ??
    [...visibleWorlds].reverse().find((w) => worldStates[w.slug] === "completed") ??
    visibleWorlds[0];
  const currentLevel =
    currentWorld?.levels.find((l) => l.state === "Actual") ??
    currentWorld?.levels.find((l) => l.state !== "Completado") ??
    currentWorld?.levels[0];

  function leave() {
    logout();
    navigate("/login");
  }

  return (
    <main
      className="relative min-h-dvh flex flex-col items-center gap-6 p-6 pb-12 animate-page-fade bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url("${assets.homeBg}")` }}
    >
      {/* Contador de estrellas de la cuenta (siempre visible, arriba a la derecha). */}
      <StarCounter className="fixed top-4 right-4 z-30" />
      <header className="w-full max-w-3xl flex flex-col items-start gap-3">
        <Button variant="secondary" onClick={() => navigate("/mundos")}>
          <ArrowLeft size={20} />
          Volver a mundos
        </Button>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-accent-strong">TYPELY</span>
          <h1 className="text-3xl sm:text-4xl font-black font-display text-text">Mi cuenta</h1>
          <p className="text-muted font-bold">Tu lugar para ver tu aventura y tus insignias.</p>
        </div>
      </header>

      <section className="w-full max-w-3xl glass-card-smooth tarjeta-marca p-6 sm:p-8 flex flex-col items-center gap-5 text-center animate-card-in">
        <span className="grid place-items-center w-20 h-20 rounded-full bg-gradient-to-br from-accent-sky to-accent-strong text-white shadow-btn">
          <Sparkles size={42} />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-black font-display text-text">{user?.name ?? "Estudiante"}</h2>
          <p className="text-muted font-semibold">{user?.email ?? "Estudiante de TYPELY"}</p>
        </div>

        <dl className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
          <div className="glass-surface rounded-2xl p-4 flex flex-col gap-1">
            <dt className="text-xs font-bold uppercase tracking-wider text-muted">Mundo actual</dt>
            <dd className="font-display font-bold text-lg text-text">{currentWorld?.title ?? "Aún no empezaste"}</dd>
          </div>
          <div className="glass-surface rounded-2xl p-4 flex flex-col gap-1">
            <dt className="text-xs font-bold uppercase tracking-wider text-muted">Misión actual</dt>
            <dd className="font-display font-bold text-lg text-text">{currentLevel?.name ?? "Elegí tu primer nivel"}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap justify-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-200/50 text-amber-800 px-4 py-2 font-bold text-sm">
            <Medal size={20} />
            {totalStars > 0 ? `${totalStars} estrellas ganadas` : "Sin estrellas todavía"}
          </span>
        </div>

        <p className="text-muted font-semibold">Cada tecla que encontrás te acerca a una nueva isla. Seguí jugando con calma.</p>

        <div className="flex flex-wrap justify-center gap-3 w-full">
          <Button onClick={() => navigate("/mundos")}>Volver a mundos</Button>
          <Button variant="secondary" onClick={() => navigate("/logros")}>
            Ver logros
          </Button>
          <Button variant="ghost" onClick={leave}>
            <LogOut size={19} />
            Cerrar sesión
          </Button>
        </div>
      </section>
    </main>
  );
}
