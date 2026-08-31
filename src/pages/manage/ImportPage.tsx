/* Importar una lista de alumnos desde una planilla.
 *
 * El flujo tiene TRES pasos, y el del medio es el que importa:
 *
 *   pegar/subir  →  VISTA PREVIA  →  confirmar
 *
 * La vista previa no escribe nada: muestra exactamente qué cuentas se
 * crearían, con qué usuario, y qué filas se van a saltear y por qué. Sin
 * ella, una columna corrida en el CSV crea 300 usuarios basura que después
 * hay que borrar de a uno.
 *
 * El alta es transaccional del lado del servidor: entra todo o no entra
 * nada. No existe el estado "se crearon 150 de 300 y no sé cuáles".
 */

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ImportPreview, ImportResult } from "../../utils/api";
import { api, ApiError } from "../../utils/api";
import { useSede } from "./ManageShell";
import { CredentialsPanel } from "./Credentials";
import { Button, Card, ErrorBanner, PageBody, PageHeader } from "./ui";

const EJEMPLO = `nombre,rol,grupo,email
Sofía Gómez,alumno,,
Lucas Pérez,alumno,,
Marcela Ruiz,docente,,mruiz@escuela.edu.ar`;

export function ImportPage() {
  const { groupId } = useParams();
  const { sedeId } = useSede();

  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const backTo = groupId ? `/gestion/grupos/${groupId}` : "/gestion/grupos";

  async function doPreview() {
    if (!csv.trim()) {
      setError("Pegá la lista o elegí un archivo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setPreview(await api.importPreview(csv, { sedeId, groupId }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos leer la planilla.");
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    setBusy(true);
    setError("");
    try {
      setResult(await api.importUsers(csv, { sedeId, groupId }));
      setPreview(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos completar la importación.");
    } finally {
      setBusy(false);
    }
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(String(reader.result ?? ""));
      setPreview(null);
      setError("");
    };
    reader.readAsText(file, "utf-8");
  }

  /* ---- Paso 3: listo, con las credenciales para repartir ---- */
  if (result) {
    return (
      <PageBody>
        <PageHeader
          title="Importación lista"
          subtitle={`Se crearon ${result.created} cuenta${result.created === 1 ? "" : "s"}.`}
          action={
            <Link to={backTo} className="text-sm font-semibold text-[#3159e8] hover:underline">
              ← Volver al grupo
            </Link>
          }
        />
        {result.credentials.length > 0 && (
          <CredentialsPanel
            title="Credenciales para repartir"
            credentials={result.credentials}
            onClose={() => setResult(null)}
          />
        )}
        {result.skipped > 0 && (
          <Card className="p-5">
            <h2 className="text-sm font-bold text-[#101828]">
              {result.skipped} fila{result.skipped === 1 ? "" : "s"} sin crear
            </h2>
            <ul className="mt-2 list-inside list-disc text-sm text-[#667085]">
              {result.errors.map((e, i) => (
                <li key={i}>Línea {e.line}: {e.message}</li>
              ))}
            </ul>
          </Card>
        )}
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Importar lista"
        subtitle="Pegá la planilla del curso o subí un archivo CSV."
        action={
          <Link to={backTo} className="text-sm font-semibold text-[#3159e8] hover:underline">
            ← Volver
          </Link>
        }
      />

      <Card className="mb-4 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[#101828]">1. La lista</h2>
          <label className="cursor-pointer text-sm font-semibold text-[#3159e8] hover:underline">
            Elegir archivo CSV
            <input type="file" accept=".csv,text/csv,text/plain" onChange={pickFile} className="sr-only" />
          </label>
        </div>

        <textarea
          value={csv}
          onChange={(e) => { setCsv(e.target.value); setPreview(null); }}
          rows={9}
          spellCheck={false}
          placeholder={EJEMPLO}
          className="w-full rounded-lg border border-[#d5d9e2] bg-white px-3 py-2 font-mono text-[13px] leading-relaxed text-[#1a2233] outline-none focus:border-[#3159e8] focus:ring-2 focus:ring-[#3159e8]/15"
        />

        <div className="mt-3 rounded-lg bg-[#f6f7f9] px-4 py-3 text-xs leading-relaxed text-[#667085]">
          <p className="font-semibold text-[#475069]">Columnas: nombre, rol, grupo, email</p>
          <p className="mt-1">
            Solo <strong>nombre</strong> es obligatorio. <strong>rol</strong> vacío = alumno.
            {groupId
                ? " Las filas sin grupo entran en este grupo."
                : " El grupo se crea si no existe."}{" "}
            El <strong>email</strong> es opcional: un alumno no lo necesita.
          </p>
        </div>

        {error && <div className="mt-4"><ErrorBanner message={error} /></div>}

        <div className="mt-4">
          <Button variant="primary" onClick={() => void doPreview()} loading={busy} disabled={!csv.trim()}>
            Ver qué se va a crear
          </Button>
        </div>
      </Card>

      {preview && (
        <Card className="p-5">
          <h2 className="text-sm font-bold text-[#101828]">2. Revisá antes de confirmar</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Todavía no se creó nada. Se van a crear <strong>{preview.willCreate}</strong> cuenta
            {preview.willCreate === 1 ? "" : "s"}
            {preview.groupsToCreate.length > 0 && (
              <> y {preview.groupsToCreate.length} grupo{preview.groupsToCreate.length === 1 ? "" : "s"} nuevo{preview.groupsToCreate.length === 1 ? "" : "s"} ({preview.groupsToCreate.join(", ")})</>
            )}
            .
          </p>

          {(preview.errors.length > 0 || preview.skipped.length > 0) && (
            <div className="mt-4 rounded-lg border border-[#f5c86b] bg-[#fffbf2] px-4 py-3">
              <p className="text-sm font-semibold text-[#93601a]">
                {preview.errors.length + preview.skipped.length} fila
                {preview.errors.length + preview.skipped.length === 1 ? "" : "s"} no se van a crear
              </p>
              <ul className="mt-1.5 list-inside list-disc text-xs text-[#667085]">
                {[...preview.errors, ...preview.skipped].map((e, i) => (
                  <li key={i}>Línea {e.line}: {e.message}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.preview.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-lg border border-[#e3e6ec]">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#e3e6ec] bg-[#fafbfc] text-left">
                    <th scope="col" className="px-4 py-2.5 font-semibold text-[#475069]">Nombre</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold text-[#475069]">Usuario</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold text-[#475069]">Rol</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold text-[#475069]">Grupo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef1f6]">
                  {preview.preview.map((r) => (
                    <tr key={r.line}>
                      <td className="px-4 py-2.5 text-[#101828]">{r.fullName}</td>
                      <td className="px-4 py-2.5 font-mono text-[13px] text-[#475069]">{r.username}</td>
                      <td className="px-4 py-2.5 text-[#475069]">{r.role}</td>
                      <td className="px-4 py-2.5 text-[#475069]">{r.group ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button
              variant="primary"
              onClick={() => void doImport()}
              loading={busy}
              disabled={preview.willCreate === 0}
            >
              Crear {preview.willCreate} cuenta{preview.willCreate === 1 ? "" : "s"}
            </Button>
            <Button variant="secondary" onClick={() => setPreview(null)} disabled={busy}>
              Volver a editar
            </Button>
          </div>
        </Card>
      )}
    </PageBody>
  );
}
