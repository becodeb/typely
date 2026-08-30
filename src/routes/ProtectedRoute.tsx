import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "../types";
import { useAuth } from "../hooks/useAuth";
import { routeForRole } from "../utils/storage";

/**
 * Puerta por rol.
 *
 * La versión anterior tenía un bypass: el superadmin entraba a cualquier
 * ruta, y un modo "ver como" le dejaba además entrar a las pantallas de
 * alumno. Eso se fue junto con el god mode. Acá cada ruta declara qué
 * roles la pueden ver y no hay excepciones.
 */
export function ProtectedRoute({ roles }: { roles: Role[] }) {
  const { user, bootstrapping } = useAuth();
  const location = useLocation();

  /* Mientras se intenta recuperar la sesión desde la cookie no se decide
     nada: sin esto, un refresh en una ruta protegida rebota al login antes
     de que la sesión llegue a restaurarse. */
  if (bootstrapping) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(180deg, #cfeeff 0%, #e8f6ff 100%)",
          fontFamily: "var(--font-display)",
          color: "#17355f",
          letterSpacing: "0.04em",
        }}
        aria-live="polite"
        aria-busy="true"
      >
        <span>Cargando…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  /* Quien entró con una contraseña temporal no llega a ninguna pantalla
     hasta cambiarla. */
  if (user.mustChangePassword && location.pathname !== "/cambiar-contrasena") {
    return <Navigate to="/cambiar-contrasena" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={routeForRole(user.role)} replace />;
  }

  return <Outlet />;
}
