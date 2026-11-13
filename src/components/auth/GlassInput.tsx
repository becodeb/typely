import type { ReactNode } from "react";

/* Campo del login (CLAUDE.md §5): cápsula blanca con el ícono en una
   burbuja de color de marca y foco turquesa. Estilos en `.login-campo`
   (global.css); sólo lo usa LoginPage. */
interface GlassInputProps {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  action?: ReactNode;
  /** Color de la burbuja del ícono. */
  tone?: "menta" | "violeta";
}

export function GlassInput({
  action,
  autoComplete,
  icon,
  label,
  onChange,
  tone = "menta",
  type = "text",
  value,
}: GlassInputProps) {
  return (
    <label className="login-campo">
      <span className="absolute w-px h-px overflow-hidden whitespace-nowrap clip-0">
        {label}
      </span>
      <span className={`login-campo__icono login-campo__icono--${tone}`} aria-hidden="true">
        {icon}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        autoComplete={autoComplete}
        placeholder={label}
      />
      {action}
    </label>
  );
}
