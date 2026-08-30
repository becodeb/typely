/* Grupos — la lista de cursos de una escuela.
 *
 * Cada fila es un enlace al detalle: nombre, cuánta gente hay y cómo viene
 * el curso, en una línea legible de un vistazo. El progreso es la precisión
 * media de sus alumnos — el mismo número que muestra la ficha de cada uno,
 * para que la lista y el detalle no digan cosas distintas.
 *
 * Los datos vienen del marco (`useSede()`), que también los usa para los
 * totales de la columna izquierda: cargarlos dos veces los haría discrepar.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
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

/* Un color por grado, del rango de la marca. No es decoración: es lo que
   deja reconocer un curso en la lista sin llegar a leer el nombre. */
const GRADE_TINT: Record<string, { fg: string; bg: string }> = {
  inicial: { fg: "#c4568f", bg: "#fdeaf3" },
  "1ep": { fg: "#0f9fc4", bg: "#e2f5fb" },
  "2ep": { fg: "#0f9fc4", bg: "#e2f5fb" },
  "3ep": { fg: "#12a294", bg: "#ddf3f0" },
  "4ep": { fg: "#12a294", bg: "#ddf3f0" },
  "5ep": { fg: "#3159e8", bg: "#e6ecff" },
  "6ep": { fg: "#3159e8", bg: "#e6ecff" },
  sec: { fg: "#7c5ce0", bg: "#eee9fd" },
  libre: { fg: "#60769c", bg: "#eef2f8" },
};

function tintFor(grade: string) {
  return GRADE_TINT[grade] ?? GRADE_TINT.libre!;
}

/** "4.º B" → "4B": se descarta lo que no sea letra o número y se toman
 *  los dos primeros caracteres. */
function shortLabel(name: string): string {
  const clean = name.replace(/[^A-Za-z0-9]/g, "");
  return (clean.slice(0, 2) || name.slice(0, 2)).toUpperCase();
}

export function GroupsPage() {
  const { sedeId, groups, groupsError, reloadGroups } = useSede();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Grupos"
        subtitle="Entrá a un grupo para ver sus alumnos, sus docentes y su progreso."
        action={
          <div className="flex gap-2">
            <Link
              to="/gestion/importar"
              className="inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-[#dde5f0] bg-white px-3.5 text-[13px] font-semibold text-[#17355f] transition-colors hover:bg-[#f4f6fa]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Importar
            </Link>
            {!creating && (
              <Button variant="primary" onClick={() => setCreating(true)}>
                Nuevo grupo
              </Button>
            )}
          </div>
        }
      />

      {creating && (
        <NewGroupForm
          sedeId={sedeId}
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reloadGroups();
          }}
        />
      )}

      {groupsError && !groups ? (
        <ErrorBanner message={groupsError} onRetry={reloadGroups} />
      ) : groups === null ? (
        <Card className="overflow-hidden">
          <TableSkeleton />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
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
        </Card>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {groups.map((g) => (
            <li key={g.id}>
              <GroupRow group={g} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function GroupRow({ group: g }: { group: Group }) {
  const tint = tintFor(g.grade);
  const students = g.studentCount ?? 0;
  const teachers = g.teacherCount ?? 0;
  const progress = g.avgProgress ?? 0;

  return (
    <Link
      to={`/gestion/grupos/${g.id}`}
      className="flex items-center gap-4 rounded-[13px] border border-[#e6ecf4] bg-white px-[18px] py-[15px] transition-colors hover:border-[#cfdcf0] hover:bg-[#fcfdff]"
    >
      <span
        className="font-display grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl text-[17px] font-bold"
        style={{ background: tint.bg, color: tint.fg }}
        aria-hidden="true"
      >
        {shortLabel(g.name)}
      </span>

      <span className="min-w-0 sm:min-w-[168px]">
        <span className="block truncate text-[15px] font-semibold text-[#17355f]">{g.name}</span>
        <span className="mt-px block text-[12.5px] text-[#7f92b0]">{gradeLabel(g.grade)}</span>
      </span>

      <span className="hidden gap-7 sm:flex">
        <span className="block">
          <span className="block text-[15px] font-semibold tabular-nums text-[#17355f]">{students}</span>
          <span className="block text-[11.5px] text-[#93a5c2]">{students === 1 ? "alumno" : "alumnos"}</span>
        </span>
        <span className="block">
          <span
            className="block text-[15px] font-semibold tabular-nums"
            style={{ color: teachers === 0 ? "#d1436a" : "#17355f" }}
          >
            {teachers === 0 ? "—" : teachers}
          </span>
          <span className="block text-[11.5px] text-[#93a5c2]">{teachers === 1 ? "docente" : "docentes"}</span>
        </span>
      </span>

      <span className="hidden min-w-[90px] flex-1 lg:block">
        <span className="mb-1.5 flex justify-between">
          <span className="text-[11.5px] text-[#93a5c2]">Progreso</span>
          <span className="text-[11.5px] font-semibold text-[#60769c]">
            {students === 0 ? "—" : `${progress}%`}
          </span>
        </span>
        <span className="block h-1.5 overflow-hidden rounded-full bg-[#eef2f8]">
          <span
            className="block h-full rounded-full"
            style={{ width: `${students === 0 ? 0 : progress}%`, background: tint.fg }}
          />
        </span>
      </span>

      {/* Un grupo sin docente es un problema real —nadie ve el progreso de
          esos alumnos— así que se marca en vez de mostrar un cero mudo. */}
      {teachers === 0 && (
        <span className="whitespace-nowrap rounded-[7px] bg-[#fff1f4] px-2.5 py-1 text-[11.5px] font-semibold text-[#d1436a]">
          Sin docente
        </span>
      )}

      <span className="ml-auto grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-[#f2f6fc] text-[#3159e8]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */

function NewGroupForm({
  sedeId,
  onCreated,
  onCancel,
}: {
  sedeId: string;
  onCreated: () => void;
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
      await api.createGroup({ name: clean, grade, sedeId });
      onCreated();
    } catch (err) {
      /* 409 = ya existe un grupo con ese nombre en esta escuela. Es un
         error DEL CAMPO, así que va debajo del input y no en un cartel
         arriba, donde habría que buscarlo. */
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
              onChange={(e) => { setName(e.target.value); if (nameError) setNameError(""); }}
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
