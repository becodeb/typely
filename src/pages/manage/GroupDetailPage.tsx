/* Detalle de un grupo — sus alumnos y sus docentes.
 *
 * Es la pantalla donde el sistema se vuelve real: acá se cargan las
 * cuentas que después van a jugar. Todo lo demás existe para llegar acá.
 *
 * Dos altas distintas, a propósito:
 *  - **Alumno**: solo el nombre. No tiene email ni lo necesita; el sistema
 *    le genera usuario y contraseña temporal, que se muestran una vez.
 *  - **Docente**: se ASIGNA uno que ya existe en la escuela. Crearlo desde
 *    acá mezclaría dos cosas —dar de alta una persona y ponerla a cargo de
 *    un curso— que conviene mantener separadas.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ApiUser, Group, GroupMember, IssuedCredentials } from "../../types";
import { api, ApiError } from "../../utils/api";
import { useSede } from "./ManageShell";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  PageBody,
  PageHeader,
  Select,
  Spinner,
  RowsSkeleton,
  gradeLabel,
} from "./ui";

interface Members {
  group: Group;
  students: GroupMember[];
  teachers: GroupMember[];
}

export function GroupDetailPage() {
  const { groupId = "" } = useParams();
  /* `reloadGroups` mantiene al día los contadores de la columna: sin eso,
     agregar un alumno acá dejaba el total de la izquierda desfasado. */
  const { sedeId, reloadGroups, showCredentials } = useSede();

  const [data, setData] = useState<Members | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await api.groupMembers(groupId));
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError ? err.message : "No pudimos cargar el grupo.");
    }
  }, [groupId]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  return (
    <PageBody>
      <PageHeader
        title={data?.group.name ?? "Grupo"}
        subtitle={data ? `${gradeLabel(data.group.grade)} · ${data.students.length} alumnos` : undefined}
        action={
          <Link
            to="/gestion/grupos"
            className="text-sm font-semibold text-[#3159e8] hover:underline"
          >
            ← Volver a grupos
          </Link>
        }
      />

      {error && !data ? (
        <ErrorBanner message={error} onRetry={() => void load()} />
      ) : !data ? (
        <Card className="overflow-hidden">
          <RowsSkeleton />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <TeachersSection
            groupId={groupId}
            sedeId={sedeId}
            teachers={data.teachers}
            onChanged={() => { void load(); reloadGroups(); }}
          />
          <StudentsSection
            groupId={groupId}
            sedeId={sedeId}
            students={data.students}
            onChanged={() => { void load(); reloadGroups(); }}
            onIssued={(v) => showCredentials(v.title, v.list)}
          />
        </div>
      )}
    </PageBody>
  );
}

/* ================================================================== */
/* Docentes                                                            */
/* ================================================================== */

function TeachersSection({
  groupId,
  sedeId,
  teachers,
  onChanged,
}: {
  groupId: string;
  sedeId: string;
  teachers: GroupMember[];
  onChanged: () => void;
}) {
  const [available, setAvailable] = useState<ApiUser[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const assignedIds = useMemo(() => new Set(teachers.map((t) => t.id)), [teachers]);

  async function openPicker() {
    setPicking(true);
    setError("");
    if (available) return;
    try {
      setAvailable(await api.users({ role: "docente", sedeId }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos cargar los docentes.");
    }
  }

  async function assign() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api.addTeacher(groupId, selected);
      setSelected("");
      setPicking(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos asignar el docente.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string) {
    setBusy(true);
    try {
      await api.removeTeacher(groupId, userId);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos quitar el docente.");
    } finally {
      setBusy(false);
    }
  }

  const selectable = (available ?? []).filter((u) => !assignedIds.has(u.id));

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[#e3e6ec] px-5 py-3.5">
        <h2 className="text-sm font-bold text-[#101828]">Docentes a cargo</h2>
        {!picking && (
          <Button variant="secondary" onClick={() => void openPicker()}>
            Asignar docente
          </Button>
        )}
      </div>

      {picking && (
        <div className="flex flex-wrap items-end gap-3 border-b border-[#e3e6ec] bg-[#fafbfc] px-5 py-4">
          <div className="min-w-[16rem] flex-1">
            <Field label="Docente" htmlFor="teacher-pick">
              {available === null ? (
                <div className="flex items-center gap-2 py-2 text-sm text-[#667085]">
                  <Spinner /> Cargando…
                </div>
              ) : (
                <Select id="teacher-pick" value={selected} onChange={(e) => setSelected(e.target.value)}>
                  <option value="">Elegí un docente…</option>
                  {selectable.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.username})
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Button variant="primary" onClick={() => void assign()} loading={busy} disabled={!selected}>
            Asignar
          </Button>
          <Button variant="secondary" onClick={() => setPicking(false)} disabled={busy}>
            Cancelar
          </Button>
          {available !== null && selectable.length === 0 && (
            <p className="w-full text-sm text-[#667085]">
              No hay docentes disponibles en esta escuela. Creá uno primero desde Usuarios.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="px-5 py-3">
          <ErrorBanner message={error} />
        </div>
      )}

      {teachers.length === 0 ? (
        <EmptyState
          title="Sin docente asignado"
          hint="Nadie está viendo el progreso de este grupo. Asigná al menos uno."
        />
      ) : (
        <ul className="divide-y divide-[#eef1f6]">
          {teachers.map((t) => (
            <li key={t.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[#101828]">{t.fullName}</p>
                <p className="truncate text-xs text-[#667085]">
                  {t.username}
                  {t.email ? ` · ${t.email}` : ""}
                </p>
              </div>
              <Button variant="ghost" onClick={() => void remove(t.id)} disabled={busy}>
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ================================================================== */
/* Alumnos                                                             */
/* ================================================================== */

function StudentsSection({
  groupId,
  sedeId,
  students,
  onChanged,
  onIssued,
}: {
  groupId: string;
  sedeId: string;
  students: GroupMember[];
  onChanged: () => void;
  onIssued: (v: { title: string; list: IssuedCredentials[] }) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function createStudent(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setNameError("Escribí el nombre y apellido del alumno.");
      return;
    }
    setSaving(true);
    setNameError("");
    setError("");
    try {
      const res = await api.createUser({ fullName: clean, role: "alumno", groupId, sedeId });
      setName("");
      onChanged();
      if (res.temporaryPassword) {
        onIssued({
          title: `Credenciales de ${res.user.fullName}`,
          list: [
            {
              fullName: res.user.fullName,
              username: res.user.username,
              temporaryPassword: res.temporaryPassword,
              role: "alumno",
            },
          ],
        });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setNameError(err.message);
      else setError(err instanceof ApiError ? err.message : "No pudimos crear el alumno.");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(s: GroupMember) {
    setBusyId(s.id);
    setError("");
    try {
      const res = await api.resetPassword(s.id);
      onIssued({
        title: `Nueva contraseña de ${s.fullName}`,
        list: [
          {
            fullName: s.fullName,
            username: s.username,
            temporaryPassword: res.temporaryPassword,
            role: "alumno",
          },
        ],
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos regenerar la contraseña.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeFromGroup(s: GroupMember) {
    setBusyId(s.id);
    setError("");
    try {
      await api.removeStudent(groupId, s.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos quitar el alumno.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3e6ec] px-5 py-3.5">
        <h2 className="text-sm font-bold text-[#101828]">Alumnos</h2>
        <div className="flex gap-2">
          <Link
            to={`/gestion/grupos/${groupId}/importar`}
            className="inline-flex items-center rounded-lg border border-[#d5d9e2] bg-white px-3.5 py-2 text-sm font-semibold text-[#1a2233] hover:bg-[#f4f6fa]"
          >
            Importar lista
          </Link>
          {!adding && (
            <Button variant="primary" onClick={() => setAdding(true)}>
              Agregar alumno
            </Button>
          )}
        </div>
      </div>

      {adding && (
        <form
          onSubmit={createStudent}
          className="flex flex-wrap items-end gap-3 border-b border-[#e3e6ec] bg-[#fafbfc] px-5 py-4"
        >
          <div className="min-w-[16rem] flex-1">
            <Field
              label="Nombre y apellido"
              htmlFor="student-name"
              hint="El usuario y la contraseña se generan solos."
              error={nameError || undefined}
            >
              <Input
                id="student-name"
                value={name}
                onChange={(e) => { setName(e.target.value); if (nameError) setNameError(""); }}
                placeholder="Sofía Gómez"
                invalid={Boolean(nameError)}
                autoFocus
              />
            </Field>
          </div>
          <Button type="submit" variant="primary" loading={saving}>
            Crear
          </Button>
          <Button type="button" variant="secondary" onClick={() => { setAdding(false); setName(""); setNameError(""); }} disabled={saving}>
            Listo
          </Button>
        </form>
      )}

      {error && (
        <div className="px-5 py-3">
          <ErrorBanner message={error} />
        </div>
      )}

      {students.length === 0 ? (
        <EmptyState
          title="Todavía no hay alumnos"
          hint="Agregalos de a uno, o importá la lista del curso desde una planilla."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[38rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e3e6ec] bg-[#fafbfc] text-left">
                <th scope="col" className="px-5 py-3 font-semibold text-[#475069]">Alumno</th>
                <th scope="col" className="px-5 py-3 font-semibold text-[#475069]">Usuario</th>
                <th scope="col" className="px-5 py-3 font-semibold text-[#475069]">Última entrada</th>
                <th scope="col" className="px-5 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef1f6]">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-[#fafbfc]">
                  <td className="px-5 py-3.5 font-semibold text-[#101828]">{s.fullName}</td>
                  <td className="px-5 py-3.5 font-mono text-[13px] text-[#475069]">{s.username}</td>
                  <td className="px-5 py-3.5 text-[#667085]">
                    {s.lastLoginAt ? (
                      new Date(s.lastLoginAt).toLocaleDateString("es-AR")
                    ) : (
                      /* "Nunca entró" es información, no un hueco: dice que
                         a esa persona todavía hay que entregarle la clave. */
                      <span className="text-[#98a2b3]">Nunca entró</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <Button variant="ghost" onClick={() => void resetPassword(s)} disabled={busyId === s.id}>
                      Nueva contraseña
                    </Button>
                    <Button variant="ghost" onClick={() => void removeFromGroup(s)} disabled={busyId === s.id}>
                      Quitar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
