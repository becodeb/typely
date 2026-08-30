/* Grupos — la lista de cursos de una sede, y el alta de uno nuevo.
 *
 * Es la primera pantalla de gestión y fija el patrón para las que siguen:
 * cargar con estado explícito (cargando / error con reintento / vacío con
 * instrucción / datos), y un alta que no saca al usuario de la lista.
 *
 * Detalle que importa: el nombre del grupo es único por sede. Cuando la
 * base rechaza un duplicado, el error se muestra PEGADO al campo, no en un
 * cartel arriba — el usuario tiene que ver dónde está el problema sin
 * buscarlo.
 */

import { useCallback, useEffect, useState } from "react";
import type { Group } from "../../types";
import { api, ApiError } from "../../utils/api";
import { useSede } from "./ManageShell";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  GRADES,
  Input,
  PageHeader,
  Select,
  TableSkeleton,
  gradeLabel,
} from "./ui";

export function GroupsPage() {
  const { sedeId, sedeName } = useSede();

  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setGroups(await api.groups(sedeId));
    } catch (err) {
      setGroups(null);
      setError(err instanceof ApiError ? err.message : "No pudimos cargar los grupos.");
    }
  }, [sedeId]);

  /* Al cambiar de sede se vacía la lista antes de pedir la nueva: si no,
     se ven por un instante los grupos de la sede anterior bajo el nombre
     de la nueva, que es peor que ver el esqueleto de carga. */
  useEffect(() => {
    setGroups(null);
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Grupos"
        subtitle={sedeName}
        action={
          !creating && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Nuevo grupo
            </Button>
          )
        }
      />

      {creating && (
        <NewGroupForm
          sedeId={sedeId}
          onCancel={() => setCreating(false)}
          onCreated={(group) => {
            setCreating(false);
            /* Se inserta en el orden que usa el servidor (alfabético) para
               que la fila nueva aparezca donde el usuario la va a buscar. */
            setGroups((prev) =>
              [...(prev ?? []), { ...group, studentCount: 0, teacherCount: 0 }].sort((a, b) =>
                a.name.localeCompare(b.name, "es"),
              ),
            );
          }}
        />
      )}

      {error && !groups ? (
        <ErrorBanner message={error} onRetry={() => void load()} />
      ) : (
        <Card className="overflow-hidden">
          {groups === null ? (
            <TableSkeleton />
          ) : groups.length === 0 ? (
            <EmptyState
              title="Todavía no hay grupos"
              hint="Un grupo es un curso: 4.º B, 5.º A. Los alumnos y los docentes se cargan dentro de cada uno."
              action={
                !creating && (
                  <Button variant="primary" onClick={() => setCreating(true)}>
                    Crear el primero
                  </Button>
                )
              }
            />
          ) : (
            <GroupsTable groups={groups} />
          )}
        </Card>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function GroupsTable({ groups }: { groups: Group[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#e3e6ec] bg-[#fafbfc] text-left">
            <th scope="col" className="px-5 py-3 font-semibold text-[#475069]">Grupo</th>
            <th scope="col" className="px-5 py-3 font-semibold text-[#475069]">Grado</th>
            <th scope="col" className="px-5 py-3 text-right font-semibold text-[#475069]">Alumnos</th>
            <th scope="col" className="px-5 py-3 text-right font-semibold text-[#475069]">Docentes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eef1f6]">
          {groups.map((g) => (
            <tr key={g.id} className="hover:bg-[#fafbfc]">
              <td className="px-5 py-3.5 font-semibold text-[#101828]">{g.name}</td>
              <td className="px-5 py-3.5 text-[#475069]">{gradeLabel(g.grade)}</td>
              <td className="px-5 py-3.5 text-right tabular-nums text-[#475069]">{g.studentCount ?? 0}</td>
              <td className="px-5 py-3.5 text-right tabular-nums">
                {/* Un grupo sin docente es un problema real —nadie ve su
                    progreso— así que se marca en vez de mostrar un 0 mudo. */}
                {(g.teacherCount ?? 0) === 0 ? (
                  <span className="rounded-md bg-[#fef3f2] px-2 py-0.5 text-xs font-semibold text-[#b42318]">
                    Sin docente
                  </span>
                ) : (
                  <span className="text-[#475069]">{g.teacherCount}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function NewGroupForm({
  sedeId,
  onCreated,
  onCancel,
}: {
  sedeId: string;
  onCreated: (group: Group) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<string>("1ep");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [formError, setFormError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setNameError("Escribí un nombre para el grupo.");
      return;
    }
    setSaving(true);
    setNameError("");
    setFormError("");
    try {
      onCreated(await api.createGroup({ name: clean, grade, sedeId }));
    } catch (err) {
      /* 409 = ya existe un grupo con ese nombre en esta sede. Es un error
         DEL CAMPO, así que va abajo del input; cualquier otro es del
         formulario y va arriba. */
      if (err instanceof ApiError && err.status === 409) setNameError(err.message);
      else setFormError(err instanceof ApiError ? err.message : "No pudimos crear el grupo.");
      setSaving(false);
    }
  }

  return (
    <Card className="mb-4 p-5">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <Field label="Nombre del grupo" htmlFor="group-name" error={nameError || undefined}>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError("");
              }}
              placeholder="4.º B"
              invalid={Boolean(nameError)}
              autoFocus
            />
          </Field>
          <Field label="Grado" htmlFor="group-grade" hint="Define qué islas ve el grupo.">
            <Select id="group-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
              {GRADES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {formError && <ErrorBanner message={formError} />}

        <div className="flex gap-2">
          <Button type="submit" variant="primary" loading={saving}>
            Crear grupo
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
