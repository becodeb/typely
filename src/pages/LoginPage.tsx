import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassInput } from "../components/auth/GlassInput";
import { AnimatedButton } from "../components/auth/AnimatedButton";
import { useAuth } from "../hooks/useAuth";
import { assets } from "../utils/assets";
import { routeForRole } from "../utils/storage";
import { clearDemoProgressOnly } from "../utils/progress";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Rocket,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

/* =====================================================================
   Login page — student-first design.
   Students just enter username + password; the app auto-detects their
   role and routes them to the right screen.  Staff (teachers, admins)
   use the same form — no role picker is shown, role comes from their
   account.

   Dev/demo mode: a hidden "Entrar en modo demo" button lets you log in
   as the default demo student without any credentials.
   Staff can still log in with their real usernames.
===================================================================== */
export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  // Bumped on every error so the top red popup re-animates even if the
  // message text is identical to the previous attempt.
  const [errKey, setErrKey] = useState(0);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const { login, loginDemo } = useAuth();
  const navigate = useNavigate();

  /** Show an error in the red popup above the card (re-animates each time). */
  const showError = (msg: string) => {
    setMessage(msg);
    setErrKey((k) => k + 1);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimUser = username.trim();
    const result = await login(trimUser, password);

    if (!result.ok) {
      /* El mensaje viene del servidor: distingue credenciales incorrectas
         de cuenta desactivada o demasiados intentos seguidos. */
      showError(result.message);
      return;
    }
    const nextUser = result.user;

    // Temporary-password sign-ins must set a new password first.
    if (nextUser.mustChangePassword) {
      navigate("/cambiar-contrasena");
      return;
    }

    navigate(routeForRole(nextUser.role));
  }

  /** Demo mode — ask whether to keep the previous demo progress or start
      fresh before entering. */
  function openDemoModal() {
    setShowDemoModal(true);
  }

  function enterDemo(reset: boolean) {
    /* Only clears the demo/local level-progress key — never real user, teacher
       or admin data, and never localStorage.clear(). */
    if (reset) clearDemoProgressOnly();
    setShowDemoModal(false);
    // Demo mode ALWAYS enters as the lowest-privilege student → game map.
    // It can never reach an admin/teacher surface.
    const nextUser = loginDemo();
    navigate(routeForRole(nextUser.role));
  }

  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-cover bg-center flex items-center justify-center animate-page-fade"
      style={{ backgroundImage: `url("${assets.loginBg}")` }}
    >
      {/* Animated colourful aura over the background art (brand colours drifting). */}
      <div className="login-aura absolute inset-0 pointer-events-none z-0" aria-hidden="true" />

      {/* Mascots stand ON the green islands: lifted off the bottom edge and
          nudged inward so they read as "standing on" the painted platforms. */}
      <img
        className="absolute bottom-[17.5vh] left-[5.5vw] w-auto max-h-[62vh] animate-mascot-float pointer-events-none select-none z-10"
        src={assets.mascotFemaleWave}
        alt="Mascota saludando"
        decoding="async"
        fetchPriority="high"
      />
      <img
        className="absolute bottom-[7.5vh] right-[8vw] w-auto max-h-[72vh] animate-mascot-float pointer-events-none select-none z-10"
        src={assets.mascotMaleWave}
        alt="Mascota saludando"
        decoding="async"
        fetchPriority="high"
      />

      <section
        className="liquid-glass glass-card-smooth relative w-[min(32rem,92vw)] mx-auto my-[7vh] p-8 pt-12 text-center flex flex-col items-center gap-6 animate-card-in z-20"
        aria-label="Ingreso a TYPELY"
      >
        <span
          className="absolute -inset-8 -z-10 rounded-[2rem] bg-[radial-gradient(circle_at_50%_40%,rgba(51,199,240,0.22),transparent_60%)] blur-3xl animate-halo-drift pointer-events-none"
          aria-hidden="true"
        />
        <span
          className="absolute -left-4 top-1/3 text-2xl text-accent-pink/60 animate-sparkle-spin pointer-events-none select-none"
          aria-hidden="true"
        >
          ✦
        </span>
        <span
          className="absolute -right-4 top-1/2 text-xl text-mint/70 animate-sparkle-spin pointer-events-none select-none"
          aria-hidden="true"
        >
          ✦
        </span>
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl text-accent/60 animate-sparkle-spin pointer-events-none select-none"
          aria-hidden="true"
        >
          ✧
        </span>

        <div className="text-center">
          <h1 className="font-display text-4xl font-black mb-2 text-gradient-loop">
            ¡Bienvenido a TYPELY!
          </h1>
          <p className="text-muted font-semibold">Aprendé a escribir jugando entre las nubes ✨</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4 w-full">
          <GlassInput
            icon={<User size={21} aria-hidden="true" />}
            label="Código o usuario"
            value={username}
            onChange={setUsername}
            autoComplete="username"
          />

          <GlassInput
            icon={<ShieldCheck size={21} aria-hidden="true" />}
            label="Contraseña"
            value={password}
            onChange={setPassword}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            action={
              <button
                type="button"
                className="grid w-9 h-9 place-items-center rounded-full bg-transparent border-0 cursor-pointer text-text/60 hover:text-text transition-colors"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            }
          />

          <AnimatedButton
            type="submit"
            iconLeft={<Sparkles size={21} aria-hidden="true" />}
            iconRight={<ArrowRight size={23} aria-hidden="true" />}
          >
            Ingresar
          </AnimatedButton>

          <AnimatedButton
            type="button"
            variant="secondary"
            onClick={openDemoModal}
            iconLeft={<Rocket size={19} aria-hidden="true" />}
          >
            Entrar en modo demo
          </AnimatedButton>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted/70 font-semibold mt-1">
            <LockKeyhole size={15} aria-hidden="true" />
            Entorno seguro para aprender y enseñar
          </p>
        </form>
      </section>

      {showDemoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-overlay-fade"
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-modal-title"
        >
          <div className="modal-overlay" onClick={() => setShowDemoModal(false)} />
          <div className="glass-card-smooth modal-card relative max-h-[88vh] overflow-y-auto p-8 w-[min(24rem,90vw)] flex flex-col items-center gap-5 animate-menu-reveal">
            <span className="text-4xl" aria-hidden="true"><Rocket size={26} /></span>
            <h2 id="demo-modal-title" className="font-display text-xl font-bold text-text">Modo demo</h2>
            <p className="text-muted text-sm text-center">¿Querés continuar con el progreso anterior o empezar desde cero?</p>
            <div className="flex gap-3 w-full mt-2">
              <button
                type="button"
                className="flex-1 py-3 rounded-xl font-extrabold text-white cursor-pointer bg-gradient-to-br from-accent-sky to-accent-strong transition-transform hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => enterDemo(false)}
              >
                Continuar
              </button>
              <button
                type="button"
                className="flex-1 py-3 rounded-xl font-extrabold cursor-pointer bg-white/50 text-text transition-transform hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => enterDemo(true)}
              >
                Empezar de cero
              </button>
            </div>
            <button
              type="button"
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/30 border-0 cursor-pointer flex items-center justify-center text-text/60 hover:text-text hover:bg-white/50 transition-colors"
              aria-label="Cerrar"
              onClick={() => setShowDemoModal(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Error popup — red, floating ABOVE the card at the top-centre. The
          outer flex centres it so the drop-in animation's transform can't
          knock it off-centre. */}
      {message && (
        <div className="fixed top-6 inset-x-0 z-50 flex justify-center px-4 pointer-events-none" role="alert" aria-live="assertive">
          <div
            key={errKey}
            className="flex items-start gap-3 rounded-2xl px-5 py-3.5 bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-[0_18px_40px_rgba(225,29,72,0.4)] border border-white/30 w-[min(34rem,92vw)] pointer-events-auto animate-banner-drop"
          >
            <ShieldCheck size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
            <p className="font-bold text-sm leading-snug flex-1">{message}</p>
            <button
              type="button"
              onClick={() => setMessage("")}
              className="shrink-0 w-7 h-7 grid place-items-center rounded-full bg-white/20 hover:bg-white/35 transition cursor-pointer text-white font-black leading-none"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
