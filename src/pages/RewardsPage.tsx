import { ArrowLeft, Backpack, KeyRound, Medal, Shield, Star, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { StarCounter } from "../components/common/StarCounter";
import { assets } from "../utils/assets";
import { useAuth } from "../hooks/useAuth";
import { getUserContext } from "../utils/userContext";
import { loadProgress } from "../utils/progress";
import { getWorldsForUser, worldStarProgress } from "../data/worlds";

/* Badges unlock at real star milestones so the screen reflects actual play
   instead of a hardcoded unlocked/locked flag. */
const rewards = [
  { name: "Medalla inicial", description: "Completaste tu primera misión.", icon: Medal, threshold: 1 },
  { name: "Llave de teclas", description: "Desbloquea caminos nuevos.", icon: KeyRound, threshold: 10 },
  { name: "Escudo preciso", description: "Por escribir con cuidado.", icon: Shield, threshold: 30 },
  { name: "Mochila digital", description: "Herramientas para aprender.", icon: Backpack, threshold: 60 },
];

export function RewardsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const context = getUserContext(user);
  const progress = loadProgress();
  const totalStars = getWorldsForUser(context, progress).reduce(
    (sum, w) => sum + worldStarProgress(w.id, progress).earnedStars,
    0,
  );

  return (
    <main
      className="relative min-h-dvh flex flex-col items-center gap-6 p-6 pb-12 animate-page-fade bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url("${assets.homeBg}")` }}
    >
      {/* Contador de estrellas de la cuenta (siempre visible, arriba a la derecha). */}
      <StarCounter className="fixed top-4 right-4 z-30" />
      {/* ── Page header ── */}
      <header className="w-full max-w-3xl flex flex-col items-start gap-3">
        <Button variant="secondary" onClick={() => navigate("/mundos")}>
          <ArrowLeft size={20} />
          Volver a mundos
        </Button>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-accent-strong">TYPELY</span>
          <h1 className="text-3xl sm:text-4xl font-black font-display text-text">Logros</h1>
          <p className="text-muted font-bold">Insignias y recompensas de tu aventura digital.</p>
        </div>
      </header>

      {/* ── Hero: total stars ── */}
      <section className="w-full max-w-3xl flex items-center gap-4 glass-surface tarjeta-marca p-4 rounded-2xl animate-card-in">
        <span className="grid place-items-center w-16 h-16 rounded-2xl bg-amber-200/40 text-amber-600 shrink-0">
          <Trophy size={54} />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-2xl font-black font-display text-text">{totalStars} estrellas</h2>
          <p className="text-muted font-bold text-sm">
            Seguís avanzando por las islas con mucha curiosidad.
          </p>
        </div>
      </section>

      {/* ── Reward grid ── */}
      <section className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {rewards.map((reward) => {
          const Icon = reward.icon;
          const unlocked = totalStars >= reward.threshold;
          return (
            <article
              className={`glass-card-smooth tarjeta-marca flex flex-col items-center gap-3 p-5 text-center transition-all duration-200 ${
                unlocked
                  ? "opacity-100 shadow-card animate-star-pop"
                  : "opacity-50 grayscale"
              }`}
              key={reward.name}
            >
              <div
                className={`grid place-items-center w-16 h-16 rounded-2xl ${
                  unlocked
                    ? "bg-accent/15 text-accent-strong"
                    : "bg-white/40 text-muted"
                }`}
              >
                <Icon size={34} />
              </div>
              <h3 className="text-sm font-extrabold font-display text-text">{reward.name}</h3>
              <p className="text-xs text-muted leading-relaxed">{reward.description}</p>
              <span
                className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${
                  unlocked
                    ? "bg-mint/20 text-mint"
                    : "bg-white/50 text-muted"
                }`}
              >
                {unlocked ? "Desbloqueado" : `Por desbloquear · ${reward.threshold}★`}
              </span>
            </article>
          );
        })}
      </section>

      {/* ── Floating star decoration ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden="true">
        <Star
          size={22}
          fill="currentColor"
          className="absolute top-[12%] left-[8%] text-amber-300/50 animate-mascot-float"
          style={{ animationDelay: "0s" }}
        />
        <Star
          size={16}
          fill="currentColor"
          className="absolute top-[28%] right-[12%] text-accent-pink/40 animate-mascot-float"
          style={{ animationDelay: "1.2s" }}
        />
        <Star
          size={18}
          fill="currentColor"
          className="absolute bottom-[18%] left-[15%] text-accent-sky/40 animate-mascot-float"
          style={{ animationDelay: "2.4s" }}
        />
      </div>
    </main>
  );
}
