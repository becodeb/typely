/* Escuelas — solo del superadmin.
 *
 * Un `admin` pertenece a una escuela y no administra ninguna, así que esta
 * pantalla no existe para él (el ítem del menú tampoco).
 *
 * Se puede crear, renombrar y desactivar. NO se puede borrar desde acá a
 * propósito: borrar una escuela arrastra en cascada sus grupos, y la API
 * ya lo rechaza si tiene cuentas activas. Desactivar cubre el caso real
 * —una escuela que dejó de usar el sistema— sin poner un botón que solo
 * puede terminar mal.
 */

import { useCallback, useEffect, useState } from "react";
import type { Sede } from "../../types";
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
  RowsSkeleton,
} from "./ui";

type SedeRow = Sede & { groupCount?: number; studentCount?: number };

export function SedesPage() {
  const { reloadSedes } = useSede();

  const [sedes, setSedes] = useState<SedeRow[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SedeRow | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setSedes(await api.sedes());
    } catch (err) {
      setSedes(null);
      setError(err instanceof ApiError ? err.message : "No pudimos cargar las escuelas.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* Tras cualquier cambio se refresca también el selector de la barra:
     si no, el desplegable de arriba sigue mostrando el nombre viejo. */
  const refresh = useCallback(() => {
    void load();
    reloadSedes();
  }, [load, reloadSedes]);

  return (
    <PageBody>
      <PageHeader
        title="Escuelas"
        subtitle="Todo cuelga de acá: los grupos, los docentes y los alumnos pertenecen a una escuela."
        action={
          !creating && (
            <Button variant="primary" onClick={() => { setEditing(null); setCreating(true); }}>
              Nueva escuela
            </Button>
          )
        }
      />

      {creating && (
        <SedeForm
          onCancel={() => setCreating(false)}
          onSaved={() => { setCreating(false); refresh(); }}
        />
      )}
      {editing && (
        <SedeForm
          sede={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}

      {error && !sedes ? (
        <ErrorBanner message={error} onRetry={() => void load()} />
      ) : (
        <Card className="overflow-hidden">
          {sedes === null ? (
            <RowsSkeleton />
          ) : sedes.length === 0 ? (
            <EmptyState
              title="Todavía no hay escuelas"
              hint="Creá la primera para poder armar grupos y cargar alumnos."
              action={
                !creating && (
                  <Button variant="primary" onClick={() => setCreating(true)}>
                    Crear la primera
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#e3e6ec] bg-[#fafbfc] text-left">
                    <th scope="col" className="px-5 py-3 font-semibold text-[#475069]">Escuela</th>
                    <th scope="col" className="px-5 py-3 font-semibold text-[#475069]">Localidad</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold text-[#475069]">Grupos</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold text-[#475069]">Alumnos</th>
                    <th scope="col" className="px-5 py-3 font-semibold text-[#475069]">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef1f6]">
                  {sedes.map((s) => (
                    <tr key={s.id} className="hover:bg-[#fafbfc]">
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-[#101828]">{s.name}</span>
                        {!s.active && (
                          <span className="ml-2 rounded-md bg-[#f4f6fa] px-2 py-0.5 text-xs font-semibold text-[#667085]">
                            Inactiva
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-[#475069]">{s.city}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-[#475069]">{s.groupCount ?? 0}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-[#475069]">{s.studentCount ?? 0}</td>
                      <td className="px-5 py-3.5 text-right">
                        <Button variant="ghost" onClick={() => { setCreating(false); setEditing(s); }}>
                          Editar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </PageBody>
  );
}

/* ------------------------------------------------------------------ */

/** Mismo formulario para crear y para editar: los campos son los mismos y
 *  duplicarlo solo garantiza que se desincronicen. */
function SedeForm({
  sede,
  onSaved,
  onCancel,
}: {
  sede?: SedeRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(sede);
  const [name, setName] = useState(sede?.name ?? "");
  const [city, setCity] = useState(sede?.city ?? "");
  const [active, setActive] = useState(sede?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [formError, setFormError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setNameError("Escribí el nombre de la escuela.");
      return;
    }
    setSaving(true);
    setNameError("");
    setFormError("");
    try {
      if (sede) await api.updateSede(sede.id, { name: clean, city: city.trim() || "Sin localidad", active });
      else await api.createSede({ name: clean, city: city.trim() || undefined });
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No pudimos guardar la escuela.");
      setSaving(false);
    }
  }

  return (
    <Card className="mb-4 p-5">
      <h2 className="mb-4 text-sm font-bold text-[#101828]">
        {isEdit ? `Editar ${sede!.name}` : "Nueva escuela"}
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="sede-name" error={nameError || undefined}>
            <Input
              id="sede-name"
              value={name}
              onChange={(e) => { setName(e.target.value); if (nameError) setNameError(""); }}
              placeholder="Escuela N.º 12 Manuel Belgrano"
              invalid={Boolean(nameError)}
              autoFocus
            />
          </Field>
          <Field label="Localidad" htmlFor="sede-city" hint="Opcional.">
            <Input
              id="sede-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Rosario"
            />
          </Field>
        </div>

        {isEdit && (
          <label className="flex items-start gap-2.5 text-sm text-[#344054]">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#d5d9e2]"
            />
            <span>
              Escuela activa
              <span className="mt-0.5 block text-xs text-[#667085]">
                Desactivarla la deja fuera de uso sin borrar nada: los grupos, los alumnos y su
                progreso se conservan.
              </span>
            </span>
          </label>
        )}

        {formError && <ErrorBanner message={formError} />}

        <div className="flex gap-2">
          <Button type="submit" variant="primary" loading={saving}>
            {isEdit ? "Guardar cambios" : "Crear escuela"}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
