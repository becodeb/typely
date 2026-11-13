import type { ButtonHTMLAttributes, ReactNode } from "react";

/* Botones del login (CLAUDE.md §5). `primary` es la barra de caramelo con
   degradado menta → celeste → azul y brillo arriba; `secondary` es el botón
   blanco del modo demo. Estilos en `.login-boton` (global.css). */
interface AnimatedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  variant?: "primary" | "secondary";
}

const variantClasses: Record<"primary" | "secondary", string> = {
  primary: "login-boton login-boton--primario",
  secondary: "login-boton login-boton--demo",
};

export function AnimatedButton({
  children,
  className = "",
  iconLeft,
  iconRight,
  variant = "primary",
  ...props
}: AnimatedButtonProps) {
  return (
    <button className={`${variantClasses[variant]} ${className}`.trim()} {...props}>
      {iconLeft}
      <span>{children}</span>
      {iconRight}
    </button>
  );
}
