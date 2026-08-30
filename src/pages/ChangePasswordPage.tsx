import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { Toast } from "../components/common/Toast";
import { useAuth } from "../hooks/useAuth";
import { routeForRole } from "../utils/storage";
import { assets } from "../utils/assets";

/* =====================================================================
   "Cambiar contraseña" — shown when a user signs in with a temporary
   password (mustChangePassword). They cannot reach any dashboard until
   they choose a new password. The current password is never shown here:
   setting a new one only requires the new value (the temp login already
   proved they hold the temporary credential).
===================================================================== */
const MIN_LENGTH = 6;

export function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");

  // No session, or nothing to change → bounce away. (A user without the
  // force-change flag should never sit on this screen.)
  if (!user) return <Navigate to="/login" replace />;
  if (!user.mustChangePassword) return <Navigate to={routeForRole(user.role)} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (next.length < MIN_LENGTH) {
      setMessage(`La nueva contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (next !== confirm) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    /* No se pide la contraseña actual: quien llega acá acaba de entrar con
       la temporal. La API acepta omitirla solo en ese caso. */
    const result = await changePassword(undefined, next);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    navigate(routeForRole(result.user.role), { replace: true });
  }

  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-cover bg-center flex items-center justify-center animate-page-fade"
      style={{ backgroundImage: `url("${assets.loginBg}")` }}
    >
      <section
        className="glass-card-smooth relative w-[min(28rem,92vw)] mx-auto my-[7vh] p-8 pt-12 text-center flex flex-col items-center gap-6 animate-card-in z-20"
        aria-label="Cambiar contraseña"
      >
        <span
          className="absolute -inset-8 -z-10 rounded-[2rem] bg-[radial-gradient(circle_at_50%_40%,rgba(51,199,240,0.22),transparent_60%)] blur-3xl animate-halo-drift pointer-events-none"
          aria-hidden="true"
        />
        <div className="text-center flex flex-col items-center gap-2">
          <span className="grid place-items-center w-14 h-14 rounded-full bg-gradient-to-br from-accent-sky to-accent-strong text-white shadow-btn mb-1">
            <KeyRound size={20} />
          </span>
          <h1 className="font-display text-2xl font-bold text-text">Creá tu contraseña</h1>
          <p className="text-muted text-sm">
            Ingresaste con una clave temporal. Elegí una contraseña nueva para continuar.
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4 w-full">
          <label className="flex flex-col gap-1.5 text-left">
            <span className="text-sm font-bold text-text">Nueva contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/70 border border-white/60 text-text font-semibold placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-sky/40 focus:bg-white/90 transition-all"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-left">
            <span className="text-sm font-bold text-text">Repetir contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Repetí la contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/70 border border-white/60 text-text font-semibold placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-sky/40 focus:bg-white/90 transition-all"
            />
          </label>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 py-3 px-5 rounded-xl font-extrabold text-white cursor-pointer bg-gradient-to-br from-accent-sky to-accent-strong shadow-btn transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles size={18} /> Guardar y continuar
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center py-3 px-5 rounded-xl font-bold cursor-pointer bg-white/75 text-text shadow hover:bg-white/90 transition-transform hover:scale-[1.01] active:scale-[0.98]"
            onClick={() => {
              void logout();
              navigate("/login", { replace: true });
            }}
          >
            Cancelar y cerrar sesión
          </button>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted/70 font-semibold mt-1">
            <ShieldCheck size={15} aria-hidden="true" />
            Tu contraseña no se comparte con nadie
          </p>
        </form>
      </section>

      <Toast message={message} />
    </main>
  );
}
