/* Proveedor de sesión.
 *
 * La API es la única autoridad. La versión anterior, si la API no
 * respondía, autenticaba contra una lista de usuarios guardada en
 * localStorage —con contraseñas en texto plano y un `admin`/`admin` fijo
 * dentro del bundle público—. Eso permitía entrar al panel de
 * administración simplemente estando la API caída. Se fue por completo.
 *
 * Lo único que sigue viviendo en el navegador es el MODO DEMO: una partida
 * suelta, sin cuenta ni token, que nunca toca datos reales.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ActiveUser } from "../types";
import { api, ApiError, setAccessToken, type SessionUser } from "../utils/api";
import { clearDemoMode, isDemoMode, setDemoMode } from "../utils/storage";

/** Alumno de demostración. No existe en la base y no puede salir del juego. */
const DEMO_USER: ActiveUser = {
  id: "demo",
  name: "Explorador",
  username: "demo",
  role: "alumno",
  groupId: null,
  sedeId: null,
};

export type LoginResult =
  | { ok: true; user: ActiveUser }
  | { ok: false; message: string };

function toActiveUser(u: SessionUser): ActiveUser {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    role: u.role,
    sedeId: u.sedeId,
    groupId: u.groupId,
    mustChangePassword: u.mustChangePassword,
  };
}

interface AuthContextValue {
  user: ActiveUser | null;
  /** True mientras corre el intento silencioso de recuperar la sesión. */
  bootstrapping: boolean;
  /** True si esta sesión es el modo demo (partida local, sin cuenta). */
  demo: boolean;
  login: (identifier: string, password: string) => Promise<LoginResult>;
  loginDemo: () => ActiveUser;
  changePassword: (currentPassword: string | undefined, newPassword: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ActiveUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [demo, setDemo] = useState(() => isDemoMode());

  /* Recuperar la sesión desde la cookie de refresh. Si no hay, se muestra
     el login: no hay ningún otro camino para entrar. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      /* El demo no tiene cuenta ni cookie: se restaura desde su propia
         marca. Sin esto, recargar la página en medio de una partida de
         demostración devolvía al login. */
      if (isDemoMode()) {
        if (!cancelled) {
          setUser(DEMO_USER);
          setDemo(true);
          setBootstrapping(false);
        }
        return;
      }
      try {
        const session = await api.bootstrap();
        if (!cancelled && session) {
          setUser(toActiveUser(session));
          setDemo(false);
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string): Promise<LoginResult> => {
    try {
      const session = await api.login(identifier.trim(), password);
      const active = toActiveUser(session);
      clearDemoMode();
      setDemo(false);
      setUser(active);
      return { ok: true, user: active };
    } catch (err) {
      if (err instanceof ApiError) return { ok: false, message: err.message };
      return { ok: false, message: "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo." };
    }
  }, []);

  /* El demo nunca pide token ni toca la API: es una partida local que se
     guarda solo en este navegador. No puede llegar a ninguna pantalla de
     gestión — es alumno y nada más. */
  const loginDemo = useCallback((): ActiveUser => {
    setAccessToken(null);
    setDemoMode(true);
    setDemo(true);
    setUser(DEMO_USER);
    return DEMO_USER;
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string | undefined, newPassword: string): Promise<LoginResult> => {
      if (!user) return { ok: false, message: "No hay una sesión activa." };
      try {
        await api.changePassword(currentPassword, newPassword);
        const refreshed = { ...user, mustChangePassword: false };
        setUser(refreshed);
        return { ok: true, user: refreshed };
      } catch (err) {
        if (err instanceof ApiError) return { ok: false, message: err.message };
        return { ok: false, message: "No pudimos guardar la contraseña nueva." };
      }
    },
    [user],
  );

  const logout = useCallback(async () => {
    clearDemoMode();
    setDemo(false);
    if (!isDemoMode()) {
      try {
        await api.logout();
      } catch {
        /* Si la API no responde, igual limpiamos el estado local. */
      }
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, bootstrapping, demo, login, loginDemo, changePassword, logout }),
    [user, bootstrapping, demo, login, loginDemo, changePassword, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth tiene que usarse dentro de AuthProvider");
  return context;
}
