/* Personas — la lista de todas las cuentas a las que llegás, y todo lo que
 * se puede hacer con ellas.
 *
 * Antes esto estaba repartido: las altas en la columna izquierda, las
 * contraseñas en una columna a la derecha, y editar o borrar a alguien no
 * existía en ninguna pantalla. Para mover un alumno de curso había que ir
 * a la base. Acá está todo junto, sobre la misma fila de la persona.
 *
 * **Cada rol ve solo hacia abajo** (`permissions.ts`): el superadmin a
 * todos, el admin a docentes y alumnos de su escuela, el docente a los
 * alumnos de sus grupos. Eso vale para lo que se lista Y para lo que se
 * ofrece por fila — pero es comodidad, no seguridad: la API vuelve a
 * verificar cada operación y es la que decide.
 *
 * Editar es en la fila y no en un modal, por lo mismo que la confirmación
 * de borrado: el modal tapa a quién estás por tocar, que es justo el dato
 * que hay que releer antes de apretar.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiUser, Group, Role, Sede } from "../../types";
import { api, ApiError } from "../../utils/api";
import { useAuth } from "../../hooks/useAuth";
import { assets } from "../../utils/assets";
import { useSede } from "./ManageShell";
import {
  ROLE_TAG,
  canCreate,
  canDelete,
  canEdit,
  canMoveBetweenSedes,
  canResetPassword,
  canSee,
  creatableRoles,
  reachableRoles,
} from "./permissions";
import { Button, Card, EmptyState, ErrorBanner, Input, RowsSkeleton, Select } from "./ui";

/** Sin tildes y en minúsculas: buscar "jose" tiene que encontrar a "José". */
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function UsersPage() {
  const { user } = useAuth();
  const { sedeId, sedes, groups, reloadGroups } = useSede();
  const actorRole = (user?.role ?? "alumno") as Role;

  const [people, setPeople] = useState<ApiUser[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "todos">("todos");
  const [creating, setCreating] = useState(false);
  /* Una sola fila abierta a la vez: con varias, es fácil guardar en la
     equivocada o copiar la contraseña de otra persona. */
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ id: string; password: string } | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      /* El superadmin no pertenece a ninguna sede, así que no sale en el
         listado de una: se piden aparte y se fusionan. Sin esto, el único
         rol al que NO llegaría es el suyo. Para el resto la API ya recorta
         el alcance sola, y mandar un sedeId no cambiaría nada. */
      const [inSede, supers] = await Promise.all([
        actorRole === "superadmin" ? api.users({ sedeId }) : api.users({}),
        actorRole === "superadmin" ? api.users({ role: "superadmin" }) : Promise.resolve([]),
      ]);
      const seen = new Set<string>();
      setPeople([...supers, ...inSede].filter((u) => !seen.has(u.id) && seen.add(u.id)));
    } catch (err) {
      setPeople(null);
      setError(err instanceof ApiError ? err.message : "No pudimos cargar las cuentas.");
    }
  }, [sedeId, actorRole]);

  useEffect(() => {
    setPeople(null);
    void load();
  }, [load]);

  const roles = reachableRoles(actorRole);

  const visible = useMemo(() => {
    if (!people) return [];
    const q = fold(query.trim());
    return people
      .filter((u) => canSee(actorRole, u.role))
      .filter((u) => roleFilter === "todos" || u.role === roleFilter)
      .filter((u) => !q || fold(u.fullName).includes(q) || fold(u.username).includes(q));
  }, [people, actorRole, roleFilter, query]);

  /* Los totales se cuentan sobre TODO lo alcanzable, no sobre lo filtrado:
     si no, los chips dirían "0 docentes" apenas filtrás por alumno. */
  const counts = useMemo(() => {
    const c: Partial<Record<Role, number>> = {};
    for (const u of people ?? []) {
      if (canSee(actorRole, u.role)) c[u.role] = (c[u.role] ?? 0) + 1;
    }
    return c;
  }, [people, actorRole]);

  const afterChange = () => {
    void load();
    reloadGroups();
  };

  return (
    <>
      {/* Misma banda de cielo que Grupos: es la firma de las pantallas de
          este panel, y queda fija mientras la lista scrollea debajo. */}
      <div className="relative min-h-[128px] shrink-0 overflow-hidden">
        <img
          src={assets.homeBg}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center 62%" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(238,246,253,0) 40%, rgba(238,246,253,0.94) 100%)" }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-3 px-4 pb-4 pt-6 sm:px-8">
          <div>
            <h1 className="font-display text-[30px] font-extrabold leading-tight tracking-[-0.018em] text-[#133463]">
              Personas
            </h1>
            <p className="mt-0.5 text-[13.5px] font-medium text-[#456494]">
              Todas las cuentas que podés administrar. Entrá a una para cambiarla.
            </p>
          </div>
          {canCreate(actorRole) && !creating && (
            <Button variant="primary" onClick={() => { setCreating(true); setOpenRow(null); }}>
              Nueva cuenta
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-1 sm:px-8">
        {creating && (
          <NewUserForm
            actorRole={actorRole}
            sedeId={sedeId}
            sedes={sedes}
            groups={groups}
            onCancel={() => setCreating(false)}
            onCreated={(pass) => {
              setCreating(false);
              if (pass) setIssued(pass);
              afterChange();
            }}
          />
        )}

        {/* Buscador y filtro por rol. El filtro es de chips y no un menú
            porque además hace de resumen: se ve cuánta gente hay de cada
            tipo sin abrir nada. */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[13rem] flex-1">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9fb0c9]"
              width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" />
            </svg>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o usuario"
              aria-label="Buscar persona"
              className="!pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por rol">
            <RoleChip label="Todos" count={visible.length} on={roleFilter === "todos"} onClick={() => setRoleFilter("todos")} />
            {roles.map((r) => (
              <RoleChip
                key={r}
                label={r}
                count={counts[r] ?? 0}
                on={roleFilter === r}
                onClick={() => setRoleFilter(roleFilter === r ? "todos" : r)}
              />
            ))}
          </div>
        </div>

        {error && !people ? (
          <ErrorBanner message={error} onRetry={() => void load()} />
        ) : people === null ? (
          <RowsSkeleton />
        ) : visible.length === 0 ? (
          <Card>
            <EmptyState
              title={query || roleFilter !== "todos" ? "Nadie coincide con eso" : "Todavía no hay cuentas"}
              hint={
                query || roleFilter !== "todos"
                  ? "Probá con otro nombre, o sacá el filtro de rol."
                  : "Creá la primera con «Nueva cuenta»."
              }
            />
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((u) => (
              <li key={u.id}>
                <PersonRow
                  person={u}
                  actorRole={actorRole}
                  isSelf={u.id === user?.id}
                  sedes={sedes}
                  groups={groups}
                  open={openRow === u.id}
                  onToggle={() => { setOpenRow(openRow === u.id ? null : u.id); setIssued(null); }}
                  issuedPassword={issued?.id === u.id ? issued.password : null}
                  onIssued={(password) => setIssued({ id: u.id, password })}
                  onDismissPassword={() => setIssued(null)}
                  onChanged={afterChange}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function RoleChip({
  label, count, on, onClick,
}: { label: string; count: number; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex h-[38px] items-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold capitalize transition-colors ${
        on
          ? "border-[#3159e8] bg-[#3159e8] text-white"
          : "border-[#dde5f0] bg-white text-[#3d5580] hover:border-[#b9cbe4]"
      }`}
    >
      {label}
      <span className={`text-[11.5px] font-bold ${on ? "text-white/70" : "text-[#9fb0c9]"}`}>{count}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */

function PersonRow({
  person: u,
  actorRole,
  isSelf,
  sedes,
  groups,
  open,
  onToggle,
  issuedPassword,
  onIssued,
  onDismissPassword,
  onChanged,
}: {
  person: ApiUser;
  actorRole: Role;
  isSelf: boolean;
  sedes: Sede[];
  groups: Group[] | null;
  open: boolean;
  onToggle: () => void;
  issuedPassword: string | null;
  onIssued: (password: string) => void;
  onDismissPassword: () => void;
  onChanged: () => void;
}) {
  const tag = ROLE_TAG[u.role];
  const mayReset = canResetPassword(actorRole, u.role, isSelf);
  const mayEdit = canEdit(actorRole, u.role, isSelf);
  const mayDelete = canDelete(actorRole, u.role, isSelf);
  const group = groups?.find((g) => g.id === u.groupId);

  const [busy, setBusy] = useState<"reset" | "delete" | null>(null);
  const [confirming, setConfirming] = useState<"reset" | "delete" | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function reset() {
    setBusy("reset");
    setError("");
    try {
      const res = await api.resetPassword(u.id);
      onIssued(res.temporaryPassword);
      setConfirming(null);
      setCopied(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos restablecer la contraseña.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    setError("");
    try {
      await api.deleteUser(u.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos eliminar la cuenta.");
      setBusy(null);
      setConfirming(null);
    }
  }

  return (
    <div className="rounded-[18px] bg-white shadow-[0_4px_16px_rgba(58,89,132,0.07)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-[15px] font-bold"
          style={{ background: tag.bg, color: tag.fg }}
          aria-hidden="true"
        >
          {u.fullName.trim().charAt(0).toUpperCase() || "?"}
        </span>

        <span className="min-w-0 flex-1 basis-[11rem]">
          <span className="block truncate text-[14.5px] font-semibold leading-tight text-[#17355f]">
            {u.fullName}
            {isSelf && <span className="ml-1.5 text-[11.5px] font-medium text-[#9fb0c9]">(vos)</span>}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5">
            <span
              className="shrink-0 rounded px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.04em]"
              style={{ background: tag.bg, color: tag.fg }}
            >
              {u.role}
            </span>
            <span className="truncate font-mono text-[11.5px] text-[#7f92b0]">{u.username}</span>
          </span>
        </span>

        <span className="hidden min-w-[8rem] text-[12.5px] text-[#5b708f] sm:block">
          {u.role === "alumno" ? (group?.name ?? <span className="text-[#b3c1d6]">Sin grupo</span>) : null}
          {u.role === "superadmin" ? <span className="text-[#b3c1d6]">Toda la plataforma</span> : null}
          {u.role === "admin" || u.role === "docente"
            ? (sedes.find((s) => s.id === u.sedeId)?.name ?? <span className="text-[#b3c1d6]">Sin escuela</span>)
            : null}
        </span>

        {!u.active && (
          <span className="rounded-lg bg-[#fff1f4] px-2 py-0.5 text-[11px] font-semibold text-[#c0335c]">
            Desactivada
          </span>
        )}

        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {mayReset && confirming === null && !issuedPassword && (
            <button
              type="button"
              onClick={() => setConfirming("reset")}
              className="rounded-lg border border-[#dde5f0] px-2.5 py-1.5 text-[12px] font-semibold text-[#3d5580] transition-colors hover:border-[#33c7f0] hover:text-[#17355f]"
            >
              Contraseña
            </button>
          )}
          {mayEdit && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
                open
                  ? "border-[#3159e8] bg-[#eef3ff] text-[#3159e8]"
                  : "border-[#dde5f0] text-[#3d5580] hover:border-[#b9cbe4]"
              }`}
            >
              {open ? "Cerrar" : "Editar"}
            </button>
          )}
          {mayDelete && confirming === null && (
            <button
              type="button"
              onClick={() => setConfirming("delete")}
              aria-label={`Eliminar a ${u.fullName}`}
              className="rounded-lg border border-[#f3c6d2] px-2.5 py-1.5 text-[12px] font-semibold text-[#c0335c] transition-colors hover:bg-[#fff1f4]"
            >
              Eliminar
            </button>
          )}
        </span>
      </div>

      {error && (
        <p role="alert" className="mx-4 mb-3 rounded-lg bg-[#fff1f4] px-3 py-2 text-[12px] font-semibold text-[#c0335c]">
          {error}
        </p>
      )}

      {/* Las dos confirmaciones dicen la CONSECUENCIA, no "¿estás seguro?".
          Cortar la sesión y perder el acceso son cosas distintas y hay que
          poder distinguirlas antes de apretar. */}
      {confirming === "reset" && (
        <div className="mx-4 mb-3 rounded-xl bg-[#fff8e8] px-3.5 py-3">
          <p className="text-[12.5px] leading-snug text-[#8a6420]">
            Se genera una contraseña temporal para <b>{u.fullName}</b>. Se le corta la sesión en
            todos sus dispositivos y va a tener que elegir una nueva al entrar.
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button variant="primary" loading={busy === "reset"} onClick={() => void reset()}>
              Restablecer
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(null)} disabled={busy === "reset"}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {confirming === "delete" && (
        <div className="mx-4 mb-3 rounded-xl bg-[#fff1f4] px-3.5 py-3">
          <p className="text-[12.5px] leading-snug text-[#8d2a4b]">
            <b>{u.fullName}</b> deja de poder entrar y desaparece de los listados. Su progreso no
            se borra: si fue un error, se puede restaurar.
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button variant="danger" loading={busy === "delete"} onClick={() => void remove()}>
              Eliminar
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(null)} disabled={busy === "delete"}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {issuedPassword && (
        <div className="mx-4 mb-3 rounded-xl bg-[#eef7f4] px-3.5 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#0f8f7c]">
            Contraseña temporal de {u.username}
          </div>
          <div className="mt-1 select-all font-mono text-[17px] font-bold tracking-wide text-[#17355f]">
            {issuedPassword}
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-[#5b708f]">
            Se muestra una sola vez y no queda guardada en ningún lado. Anotala antes de cerrar.
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${u.fullName}\t${u.username}\t${issuedPassword}`);
                  setCopied(true);
                } catch {
                  /* Sin permiso de portapapeles queda a la vista para anotarla. */
                }
              }}
            >
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button variant="ghost" onClick={onDismissPassword}>
              Listo
            </Button>
          </div>
        </div>
      )}

      {open && mayEdit && (
        <EditForm
          person={u}
          actorRole={actorRole}
          sedes={sedes}
          groups={groups}
          onSaved={() => { onToggle(); onChanged(); }}
          onCancel={onToggle}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EditForm({
  person: u,
  actorRole,
  sedes,
  groups,
  onSaved,
  onCancel,
}: {
  person: ApiUser;
  actorRole: Role;
  sedes: Sede[];
  groups: Group[] | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState(u.fullName);
  const [username, setUsername] = useState(u.username);
  const [email, setEmail] = useState(u.email ?? "");
  const [sedeId, setSedeId] = useState(u.sedeId ?? "");
  const [groupId, setGroupId] = useState(u.groupId ?? "");
  const [active, setActive] = useState(u.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /* Un grupo es solo de alumnos y una escuela solo del staff: son CHECK de
     la base, no preferencias. Mostrar el campo que no corresponde invita a
     un 400 que no explica nada. */
  const showGroup = u.role === "alumno";
  const showSede = u.role !== "superadmin" && canMoveBetweenSedes(actorRole);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = fullName.trim();
    if (!clean) {
      setError("El nombre no puede quedar vacío.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.updateUser(u.id, {
        fullName: clean,
        username: username.trim(),
        email: email.trim() ? email.trim().toLowerCase() : null,
        ...(showSede ? { sedeId: sedeId || null } : {}),
        ...(showGroup ? { groupId: groupId || null } : {}),
        active,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos guardar los cambios.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-[#eef3f9] px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-[#3d5580]">Nombre y apellido</span>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-[#3d5580]">Usuario</span>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-[#3d5580]">Email (opcional)</span>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="—" />
        </label>

        {showSede && (
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-[#3d5580]">Escuela</span>
            <Select value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
              <option value="">Sin escuela</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </label>
        )}

        {showGroup && (
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-[#3d5580]">Grupo</span>
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Sin grupo</option>
              {(groups ?? []).map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </label>
        )}

        <label className="flex items-end gap-2 pb-2.5">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-[#3159e8]"
          />
          <span className="text-[12.5px] font-semibold text-[#3d5580]">
            Puede entrar
            <span className="block text-[11px] font-normal text-[#8a99b5]">
              Al desactivarla se le corta la sesión.
            </span>
          </span>
        </label>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="mt-3 flex gap-2">
        <Button type="submit" variant="primary" loading={saving}>Guardar</Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Cancelar</Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function NewUserForm({
  actorRole,
  sedeId,
  sedes,
  groups,
  onCreated,
  onCancel,
}: {
  actorRole: Role;
  sedeId: string;
  sedes: Sede[];
  groups: Group[] | null;
  onCreated: (issued: { id: string; password: string } | null) => void;
  onCancel: () => void;
}) {
  const roles = creatableRoles(actorRole);
  const [role, setRole] = useState<Role>(roles[0] ?? "alumno");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [targetSede, setTargetSede] = useState(sedeId);
  const [groupId, setGroupId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const showSede = canMoveBetweenSedes(actorRole) && role !== "superadmin";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = fullName.trim();
    if (!clean) {
      setError("Escribí el nombre y apellido.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api.createUser({
        fullName: clean,
        role,
        sedeId: showSede ? targetSede : sedeId,
        /* La API sabe dónde guardarlo: columna `group_id` si es alumno,
           fila en `group_teachers` si es docente. */
        groupId: (role === "alumno" || role === "docente") && groupId ? groupId : null,
        email: email.trim() ? email.trim().toLowerCase() : null,
      });
      /* La contraseña viene solo cuando la generó el servidor, y se ve una
         sola vez: sube a la lista para que la muestre en la fila nueva. */
      onCreated(res.temporaryPassword ? { id: res.user.id, password: res.temporaryPassword } : null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos crear la cuenta.");
      setSaving(false);
    }
  }

  return (
    <Card className="mb-3 p-5">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-[#3d5580]">Rol</span>
            <div className="flex rounded-xl bg-[#eef3f9] p-1" role="group" aria-label="Rol de la cuenta">
              {roles.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setRole(r); setGroupId(""); setError(""); }}
                  aria-pressed={role === r}
                  className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold capitalize transition-colors ${
                    role === r ? "bg-white text-[#17355f] shadow-sm" : "text-[#7f92b0] hover:text-[#17355f]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <label className="flex min-w-[13rem] flex-1 flex-col gap-1">
            <span className="text-[12px] font-semibold text-[#3d5580]">Nombre y apellido</span>
            <Input
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); if (error) setError(""); }}
              placeholder="Ana Belén Ruiz"
              autoFocus
            />
          </label>

          {showSede && (
            <label className="flex w-[13rem] flex-col gap-1">
              <span className="text-[12px] font-semibold text-[#3d5580]">Escuela</span>
              <Select value={targetSede} onChange={(e) => setTargetSede(e.target.value)}>
                {sedes.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </label>
          )}

          {/* El grupo se ofrece a los dos, pero significa cosas
              distintas: el alumno CURSA ahí, el docente queda A CARGO. Por
              eso cambia la etiqueta y no solo el valor. Para el docente es
              opcional y se puede sumar después desde el grupo. */}
          {(role === "alumno" || role === "docente") && (
            <label className="flex w-[12rem] flex-col gap-1">
              <span className="text-[12px] font-semibold text-[#3d5580]">
                {role === "alumno" ? "Grupo" : "Curso a cargo"}
              </span>
              <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">{role === "alumno" ? "Sin grupo" : "Asignar después"}</option>
                {(groups ?? []).map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </Select>
            </label>
          )}

          {role !== "alumno" && (
            <label className="flex w-[13rem] flex-col gap-1">
              <span className="text-[12px] font-semibold text-[#3d5580]">Email (opcional)</span>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          )}
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="flex gap-2">
          <Button type="submit" variant="primary" loading={saving}>
            {saving ? "Creando…" : `Crear ${role}`}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}

