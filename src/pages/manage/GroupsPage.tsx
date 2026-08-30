/* Grupos — la lista de cursos de una escuela.
 *
 * Cada grupo lleva la ISLA de su grado, la misma que ven los chicos en el
 * mapa. No es adorno: es lo que deja reconocer un curso de un vistazo,
 * antes de leer el nombre, y lo que hace que el panel y el juego se sientan
 * el mismo producto.
 *
 * El progreso es la precisión media de sus alumnos — el mismo número que
 * muestra la ficha de cada uno, para que la lista y el detalle no digan
 * cosas distintas.
 *
 * Los datos vienen del marco (`useSede()`), que también los usa para los
 * totales de la columna izquierda: cargarlos dos veces los haría discrepar.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import type { Group } from "../../types";
import { api, ApiError } from "../../utils/api";
import { assets, islandMapThumb } from "../../utils/assets";
import { useSede } from "./ManageShell";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  GRADES,
  Input,
  RowsSkeleton,
  Select,
  gradeLabel,
  islandForGrade,
  tintForGrade,
} from "./ui";

export function GroupsPage() {
  const { sedeId, groups, groupsError, reloadGroups } = useSede();
  const [creating, setCreating] = useState(false);

  return (
    <>
      {/* Banda de cielo: el mismo del juego, desvanecido hacia el fondo
          del panel para que el encabezado se apoye en él sin taparlo. */}
      <div className="relative -mx-4 -mt-6 mb-1 h-[132px] overflow-hidden sm:-mx-8">
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
        <div className="relative flex flex-wrap items-start justify-between gap-3 px-4 pt-6 sm:px-8">
          <div>
            <h1 className="font-display text-[30px] font-extrabold leading-tight tracking-[-0.018em] text-[#133463]">
              Grupos
            </h1>
            <p className="mt-0.5 text-[13.5px] font-medium text-[#456494]">
              Cada grupo tiene su isla. Entrá para ver quiénes son y cómo van.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/gestion/importar"
              className="inline-flex h-[38px] items-center gap-2 rounded-xl border border-white/90 bg-white/80 px-4 text-[13px] font-semibold text-[#17355f] backdrop-blur transition-colors hover:bg-white"
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
        </div>
      </div>

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
        <RowsSkeleton />
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
        <ul className="flex flex-col gap-3">
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
  const tint = tintForGrade(g.grade);
  const students = g.studentCount ?? 0;
  const teachers = g.teacherCount ?? 0;
  const progress = g.avgProgress ?? 0;

  return (
    <Link
      to={`/gestion/grupos/${g.id}`}
      className="flex items-center gap-4 rounded-[20px] bg-white py-[14px] pl-[14px] pr-[18px] shadow-[0_6px_22px_rgba(58,89,132,0.09)] transition-shadow hover:shadow-[0_10px_28px_rgba(58,89,132,0.15)]"
    >
      {/* La isla del grado. `loading="lazy"` porque una escuela grande
          puede tener veinte grupos y no hace falta traerlas todas de una. */}
      <span
        className="grid h-[68px] w-[68px] shrink-0 place-items-center overflow-hidden rounded-[18px]"
        style={{ background: tint.soft }}
      >
        <img
          src={islandMapThumb(islandForGrade(g.grade))}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="h-[62px] w-[62px] object-contain"
        />
      </span>

      <span className="min-w-0 sm:min-w-[150px]">
        <span className="font-display block truncate text-[20px] font-bold leading-tight text-[#17355f]">
          {g.name}
        </span>
        <span className="mt-px block text-[12.5px] text-[#7f92b0]">{gradeLabel(g.grade)}</span>
      </span>

      <span className="hidden gap-2.5 md:flex">
        <span className="rounded-xl bg-[#f2f7fd] px-3.5 py-[7px]">
          <b className="text-[15px] font-bold text-[#17355f]">{students}</b>
          <span className="ml-1 text-[11.5px] text-[#7f92b0]">
            {students === 1 ? "alumno" : "alumnos"}
          </span>
        </span>

        {/* Un grupo sin docente es un problema real —nadie ve el progreso
            de esos alumnos— así que se avisa en vez de mostrar un cero. */}
        {teachers === 0 ? (
          <span className="flex items-center gap-1.5 rounded-xl bg-[#ffeef3] px-3.5 py-[7px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1436a" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            <span className="text-[12px] font-semibold text-[#d1436a]">Sin docente</span>
          </span>
        ) : (
          <span className="rounded-xl bg-[#f2f7fd] px-3.5 py-[7px]">
            <b className="text-[15px] font-bold text-[#17355f]">{teachers}</b>
            <span className="ml-1 text-[11.5px] text-[#7f92b0]">
              {teachers === 1 ? "docente" : "docentes"}
            </span>
          </span>
        )}
      </span>

      <span className="hidden min-w-[96px] flex-1 lg:block">
        <span className="mb-1.5 flex justify-between">
          <span className="text-[11.5px] text-[#93a5c2]">Progreso</span>
          <span className="text-[12px] font-bold" style={{ color: tint.fg }}>
            {students === 0 ? "—" : `${progress}%`}
          </span>
        </span>
        <span className="block h-2 overflow-hidden rounded-full bg-[#eaf1f9]">
          <span
            className="block h-full rounded-full"
            style={{ width: `${students === 0 ? 0 : progress}%`, background: tint.bar }}
          />
        </span>
      </span>

      <span className="ml-auto grid h-[34px] w-[34px] shrink-0 place-items-center rounded-xl bg-[#eef3ff] text-[#3159e8]">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

  const tint = tintForGrade(grade);

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
    <Card className="mb-3 p-5">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Vista previa de la isla: al elegir el grado se ve qué mundo
              le toca al grupo, que es lo que después ven los chicos. */}
          <span
            className="grid h-[68px] w-[68px] shrink-0 place-items-center overflow-hidden rounded-[18px]"
            style={{ background: tint.soft }}
          >
            <img
              src={islandMapThumb(islandForGrade(grade))}
              alt=""
              aria-hidden="true"
              className="h-[62px] w-[62px] object-contain"
            />
          </span>

          <div className="min-w-[12rem] flex-1">
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
          </div>

          <div className="w-[12rem]">
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
