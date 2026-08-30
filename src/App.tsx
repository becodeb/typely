import { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { LoginLayoutEditorPage } from "./pages/LoginLayoutEditorPage";
import { GlassEditorPage } from "./pages/GlassEditorPage";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { DevLayoutEditorMount } from "./components/dev/layoutEditor";
import { WorldsPage } from "./pages/WorldsPage";
import { IslandDetailPage } from "./pages/IslandDetailPage";
import { RewardsPage } from "./pages/RewardsPage";
import { AccountPage } from "./pages/AccountPage";
import { MissionsPage } from "./pages/MissionsPage";
import { ManageShell } from "./pages/manage/ManageShell";
import { GroupsPage } from "./pages/manage/GroupsPage";
import { GroupDetailPage } from "./pages/manage/GroupDetailPage";
import { SedesPage } from "./pages/manage/SedesPage";
import { ImportPage } from "./pages/manage/ImportPage";
import { useAuth } from "./hooks/useAuth";

/* La pantalla de juego es la más pesada: se carga bajo demanda para que el
   bundle inicial (login + mapa de mundos) se mantenga chico. */
const GameplayPage = lazy(() =>
  import("./pages/GameplayPage").then((m) => ({ default: m.GameplayPage })),
);

function PageFallback() {
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

/* Marcador de posición honesto para docente y administración.
 *
 * Esas pantallas se van a construir de cero. Hasta que existan, quien
 * tiene uno de esos roles entra y ve esto — en vez de rebotar contra una
 * ruta rota o caer en el mapa de islas, que es del alumno. */
function SinPantallaPage() {
  const { user, logout } = useAuth();
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background: "linear-gradient(180deg, #cfeeff 0%, #e8f6ff 100%)",
        fontFamily: "var(--font-body)",
        color: "#17355f",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: "34rem", display: "grid", gap: "1rem" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", margin: 0 }}>
          Hola, {user?.name}
        </h1>
        <p style={{ margin: 0, fontSize: "1.05rem", lineHeight: 1.6 }}>
          Tu cuenta está activa, pero la pantalla para tu rol todavía no está construida.
        </p>
        <p style={{ margin: 0, opacity: 0.75 }}>
          El juego funciona y tu progreso se guarda. Las vistas de seguimiento llegan enseguida.
        </p>
        <button
          type="button"
          onClick={() => void logout()}
          style={{
            justifySelf: "center",
            marginTop: "0.5rem",
            padding: "0.75rem 1.5rem",
            borderRadius: "18px",
            border: "1px solid rgba(130,140,190,0.25)",
            background: "rgba(255,255,255,0.78)",
            color: "#405083",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}

function NotFoundPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(180deg, #cfeeff 0%, #e8f6ff 100%)",
        fontFamily: "var(--font-body)",
        color: "#17355f",
        textAlign: "center",
      }}
    >
      <div style={{ display: "grid", gap: "0.75rem" }}>
        <h1 style={{ fontFamily: "var(--font-display)", margin: 0 }}>No encontramos esa página</h1>
        <Link to="/" style={{ color: "#3159e8", fontWeight: 700 }}>
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      {/* Editor de layout interno (SOLO desarrollo; la doble compuerta de
          DevLayoutEditorMount lo saca del bundle de producción). */}
      <DevLayoutEditorMount />
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Cambio de contraseña forzado tras entrar con una temporal.
            Abierta a los cuatro roles: es la puerta obligatoria de todos. */}
        <Route element={<ProtectedRoute roles={["superadmin", "admin", "docente", "alumno"]} />}>
          <Route path="/cambiar-contrasena" element={<ChangePasswordPage />} />
        </Route>

        {/* El juego — exclusivo del alumno. */}
        <Route element={<ProtectedRoute roles={["alumno"]} />}>
          <Route path="/mundos" element={<WorldsPage />} />
          <Route path="/worlds/:islandId" element={<IslandDetailPage />} />
          <Route
            path="/gameplay/:activityId"
            element={
              <Suspense fallback={<PageFallback />}>
                <GameplayPage />
              </Suspense>
            }
          />
          <Route path="/logros" element={<RewardsPage />} />
          <Route path="/mi-cuenta" element={<AccountPage />} />
          <Route path="/misiones" element={<MissionsPage />} />
        </Route>

        {/* Gestión — superadmin y admin. Las dos comparten pantallas: el
            superadmin tiene los mismos permisos más el alcance, y elige
            sede con un selector en la barra. */}
        <Route element={<ProtectedRoute roles={["superadmin", "admin"]} />}>
          <Route path="/gestion" element={<ManageShell />}>
            <Route index element={<Navigate to="/gestion/grupos" replace />} />
            <Route path="sedes" element={<SedesPage />} />
            <Route path="grupos" element={<GroupsPage />} />
            <Route path="grupos/:groupId" element={<GroupDetailPage />} />
            <Route path="grupos/:groupId/importar" element={<ImportPage />} />
            <Route path="importar" element={<ImportPage />} />
          </Route>
        </Route>

        {/* El docente todavía no tiene pantalla propia. */}
        <Route element={<ProtectedRoute roles={["docente"]} />}>
          <Route path="/sin-pantalla" element={<SinPantallaPage />} />
        </Route>

        {/* Herramientas de diseño del juego. Solo en desarrollo: en el build
            de producción estas rutas no existen. */}
        {import.meta.env.DEV && (
          <>
            <Route path="/editor-login" element={<LoginLayoutEditorPage />} />
            <Route path="/editor-glass" element={<GlassEditorPage />} />
          </>
        )}

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
