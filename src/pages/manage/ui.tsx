/* Primitivas de las pantallas de gestión.
 *
 * No son las del juego —esto sigue siendo una herramienta de trabajo, con
 * densidad alta y nada que distraiga— pero tampoco son neutras: usan la
 * paleta del proyecto, sus tipografías y sus radios generosos, así que el
 * panel se siente del mismo mundo que el juego sin pretender serlo.
 *
 * El acento fuerte (el azul de la marca, y el degradado turquesa) está
 * reservado a la acción principal de cada pantalla. Si todo resalta, nada
 * resalta.
 */

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { GRADE_WORLDS } from "../../utils/userContext";
import type { GradeId } from "../../types";

/* ------------------------------------------------------------------ */
/* Botones                                                             */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-[#3159e8] text-white border-[#3159e8] shadow-[0_8px_20px_rgba(49,89,232,0.26)] hover:bg-[#2445b8] hover:border-[#2445b8]",
  secondary: "bg-white text-[#17355f] border-[#dde5f0] hover:bg-[#f4f8fd]",
  danger: "bg-white text-[#c0335c] border-[#f3c6d2] hover:bg-[#fff1f4]",
  ghost: "bg-transparent text-[#52719e] border-transparent hover:bg-[#eaf1f9]",
};

export function Button({
  variant = "secondary",
  loading = false,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex h-[38px] items-center justify-center gap-2 rounded-xl border px-4 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${BUTTON_STYLES[variant]} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Campos                                                              */
/* ------------------------------------------------------------------ */

const FIELD_BASE =
  "w-full rounded-xl border border-[#dde5f0] bg-white px-3.5 py-2.5 text-sm text-[#17355f] outline-none transition-colors placeholder:text-[#9fb0c9] focus:border-[#33c7f0] focus:ring-4 focus:ring-[#33c7f0]/15 disabled:bg-[#f4f8fd]";

/** Envoltorio con etiqueta, ayuda y error. El error se anuncia con
 *  `role="alert"`: un lector de pantalla lo lee al llegar, no queda solo
 *  como color. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-[#3d5580]">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-[#7f92b0]">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-semibold text-[#c0335c]">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({
  invalid,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={`${FIELD_BASE} ${invalid ? "border-[#e0658a] focus:border-[#e0658a] focus:ring-[#e0658a]/15" : ""} ${className}`}
    />
  );
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`${FIELD_BASE} cursor-pointer ${className}`}>
      {children}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/* Contenedores y estados                                              */
/* ------------------------------------------------------------------ */

/** Superficie blanca sobre el celeste del panel. Sin borde duro: la
 *  separación la da una sombra suave, como las tarjetas del juego. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[20px] bg-white shadow-[0_6px_22px_rgba(58,89,132,0.09)] ${className}`}>
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-[-0.018em] text-[#133463]">
          {title}
        </h1>
        {subtitle && <p className="mt-0.5 text-[13.5px] font-medium text-[#52719e]">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

/** Error de carga. Siempre ofrece reintentar: un mensaje sin salida deja
 *  al usuario con la única opción de recargar a mano. */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#f3c6d2] bg-[#fff1f4] px-4 py-3"
    >
      <p className="flex-1 text-sm font-medium text-[#c0335c]">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

/** Estado vacío. `hint` explica QUÉ hacer, no solo que no hay nada. */
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <p className="font-display text-[17px] font-bold text-[#17355f]">{title}</p>
      {hint && <p className="max-w-md text-sm text-[#60769c]">{hint}</p>}
      {action}
    </div>
  );
}

/** Esqueleto de carga: mantiene la altura de las filas para que el
 *  contenido no salte cuando llegan los datos. */
export function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-[20px] bg-white px-[18px] py-[15px]">
          <div className="h-[68px] w-[68px] shrink-0 animate-pulse rounded-[18px] bg-[#eaf1f9]" />
          <div className="flex-1">
            <div className="h-4 w-32 animate-pulse rounded bg-[#eaf1f9]" />
            <div className="mt-2 h-3 w-20 animate-pulse rounded bg-[#eef4fa]" />
          </div>
          <div className="h-3 w-40 animate-pulse rounded bg-[#eef4fa]" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Grados                                                              */
/* ------------------------------------------------------------------ */

export const GRADES = [
  { id: "inicial", label: "Inicial" },
  { id: "1ep", label: "1.º grado" },
  { id: "2ep", label: "2.º grado" },
  { id: "3ep", label: "3.º grado" },
  { id: "4ep", label: "4.º grado" },
  { id: "5ep", label: "5.º grado" },
  { id: "6ep", label: "6.º grado" },
  { id: "sec", label: "Secundaria" },
  { id: "libre", label: "Libre" },
] as const;

export function gradeLabel(id: string): string {
  return GRADES.find((g) => g.id === id)?.label ?? id;
}

/** La isla que representa a un grado: la ÚLTIMA de su recorrido, o sea
 *  la más lejos que llega ese curso.
 *
 *  Sale de `GRADE_WORLDS`, la misma tabla que decide qué mundos ve el
 *  alumno. No es una lista aparte a propósito: si mañana cambia el
 *  recorrido de 4.º, la miniatura del panel cambia con él en vez de
 *  quedar mintiendo.
 *
 *  Los primeros mundos no sirven para esto — todos los grados arrancan en
 *  island1, así que elegir el primero pintaría todos los grupos igual. */
export function islandForGrade(grade: string): string {
  const worlds = GRADE_WORLDS[grade as GradeId] ?? GRADE_WORLDS.libre;
  return worlds[worlds.length - 1] ?? "island1";
}

/** Color de acento del grado, del rango de la marca. Acompaña a la isla:
 *  el fondo de la miniatura y la barra de progreso salen de acá. */
export const GRADE_TINT: Record<string, { fg: string; soft: string; bar: string }> = {
  inicial: { fg: "#c4568f", soft: "#fdeaf3", bar: "linear-gradient(90deg,#ff9fca,#ff7da0)" },
  "1ep": { fg: "#0f9fc4", soft: "#e2f5fb", bar: "linear-gradient(90deg,#5be8ba,#33c7f0)" },
  "2ep": { fg: "#0f9fc4", soft: "#e2f5fb", bar: "linear-gradient(90deg,#5be8ba,#33c7f0)" },
  "3ep": { fg: "#12a294", soft: "#ddf3f0", bar: "linear-gradient(90deg,#5be8ba,#22c7b8)" },
  "4ep": { fg: "#12a294", soft: "#ddf3f0", bar: "linear-gradient(90deg,#5be8ba,#22c7b8)" },
  "5ep": { fg: "#3159e8", soft: "#e6ecff", bar: "linear-gradient(90deg,#7c71ff,#3159e8)" },
  "6ep": { fg: "#3159e8", soft: "#e6ecff", bar: "linear-gradient(90deg,#7c71ff,#3159e8)" },
  sec: { fg: "#7c5ce0", soft: "#eee9fd", bar: "linear-gradient(90deg,#9b7cff,#5932d4)" },
  libre: { fg: "#60769c", soft: "#eef2f8", bar: "linear-gradient(90deg,#a9bdd6,#60769c)" },
};

export function tintForGrade(grade: string) {
  return GRADE_TINT[grade] ?? GRADE_TINT.libre!;
}
