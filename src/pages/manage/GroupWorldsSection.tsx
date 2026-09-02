/* Qué islas juega un grupo.
 *
 * Por defecto, TODAS: el juego se abre solo, isla por isla, a medida que
 * el chico termina la anterior, y esa progresión ya regula la dificultad.
 * Antes había además un recorte por grado, y un primer grado terminaba sus
 * tres islas y se quedaba sin juego, con doce ahí invisibles. Eso se sacó.
 *
 * Lo de acá es otra cosa: una decisión de aula. Un docente puede querer
 * que su curso se quede en las primeras mientras trabaja un tema, y para
 * eso desmarca el resto. Es la única cosa del curso que decide el docente
 * y no el administrador.
 *
 * **Sin selección guardada significa "todas", y no es lo mismo que tenerlas
 * todas marcadas.** Guardar `null` deja al grupo siguiendo el juego
 * completo para siempre; guardar las quince congela esa lista, así que una
 * isla nueva del año que viene no le llegaría. Por eso el botón "Todas"
 * borra la selección en vez de marcar todo.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../utils/api";
import { islandMapThumb } from "../../utils/assets";
import { WORLD_PEDAGOGY_ORDER } from "../../data/activities";
import { WORLD_TOPICS } from "../../data/worlds";
import type { Activity } from "../../data/activities";
import { Button, Card, ErrorBanner, Spinner } from "./ui";

type WorldId = Activity["worldId"];

export function GroupWorldsSection({ groupId }: { groupId: string }) {
  /* `null` = sin restricción. `Set` = exactamente esas. */
  const [selection, setSelection] = useState<Set<WorldId> | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  /* El interruptor del modo Órbita viaja con las islas: misma pantalla,
     misma autorización, misma decisión de aula. */
  const [arcadeOn, setArcadeOn] = useState(true);
  const [arcadeSaving, setArcadeSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.groupWorlds(groupId);
      const next = res.worldIds ? new Set(res.worldIds as WorldId[]) : null;
      setSelection(next);
      setSaved(JSON.stringify(res.worldIds));
      setArcadeOn(res.arcadeEnabled ?? true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos cargar las islas del grupo.");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  async function toggleArcade() {
    const próximo = !arcadeOn;
    setArcadeSaving(true);
    setError("");
    try {
      await api.setGroupArcade(groupId, próximo);
      setArcadeOn(próximo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos cambiar el modo Órbita.");
    } finally {
      setArcadeSaving(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  /* Lo que se mandaría al guardar. Se compara contra lo guardado para no
     ofrecer "Guardar" cuando no hay nada que guardar. */
  const payload = useMemo(
    () => (selection === null ? null : WORLD_PEDAGOGY_ORDER.filter((id) => selection.has(id))),
    [selection],
  );
  const dirty = saved !== null && JSON.stringify(payload) !== saved;

  function toggle(id: WorldId) {
    setJustSaved(false);
    setSelection((prev) => {
      /* Desmarcar desde "todas" arranca la lista con las otras catorce:
         el gesto natural es sacar una, no empezar de cero. */
      const base = prev ?? new Set<WorldId>(WORLD_PEDAGOGY_ORDER);
      const next = new Set(base);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api.setGroupWorlds(groupId, payload);
      setSaved(JSON.stringify(payload));
      setJustSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos guardar la selección.");
    } finally {
      setSaving(false);
    }
  }

  const total = WORLD_PEDAGOGY_ORDER.length;
  const count = selection === null ? total : selection.size;
  const todas = selection === null;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef3f9] px-5 py-3.5">
        <div>
          <h2 className="font-display text-[15px] font-bold text-[#17355f]">Islas del grupo</h2>
          <p className="mt-0.5 text-[12px] text-[#8a99b5]">
            {todas
              ? "Todas. Cada chico las va abriendo a medida que termina la anterior."
              : `${count} de ${total} habilitadas. El resto no le aparece a nadie del grupo.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {justSaved && !dirty && (
            <span className="text-[12px] font-semibold text-[#0f8f7c]">Guardado</span>
          )}
          {!todas && (
            <Button
              variant="secondary"
              onClick={() => { setSelection(null); setJustSaved(false); }}
              disabled={saving}
            >
              Habilitar todas
            </Button>
          )}
          <Button variant="primary" onClick={() => void save()} loading={saving} disabled={!dirty}>
            Guardar
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-5 pt-4">
          <ErrorBanner message={error} onRetry={() => void load()} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 px-5 py-8 text-sm text-[#667085]">
          <Spinner /> Cargando…
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-5">
          {WORLD_PEDAGOGY_ORDER.map((id, i) => {
            const on = selection === null || selection.has(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  aria-pressed={on}
                  className={`flex w-full flex-col items-center gap-1 rounded-2xl border p-2.5 text-center transition-colors ${
                    on
                      ? "border-[#c9dcf3] bg-[#f4f9ff] hover:border-[#8fb8e8]"
                      : "border-[#eef1f6] bg-white hover:border-[#dde5f0]"
                  }`}
                >
                  <img
                    src={islandMapThumb(id)}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    /* Apagada la que no juega: en escala de grises se
                       distingue de la habilitada sin leer nada. */
                    className={`h-12 w-12 object-contain transition ${on ? "" : "opacity-35 grayscale"}`}
                  />
                  <span className={`text-[11.5px] font-bold ${on ? "text-[#17355f]" : "text-[#9fb0c9]"}`}>
                    M{i + 1}
                  </span>
                  <span className={`text-[10.5px] leading-tight ${on ? "text-[#5b708f]" : "text-[#b3c1d6]"}`}>
                    {WORLD_TOPICS[id]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ---- Modo Órbita (arcade) ----
          Apagarlo NO borra nada: el orbe se ve dormido para el grupo y los
          récords quedan esperando. Es la herramienta para reconducir un
          aula que se fue entera al arcade. */}
      {!loading && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef3f9] px-5 py-3.5">
          <div>
            <h3 className="font-display text-[14px] font-bold text-[#17355f]">
              Modo Órbita (arcade)
            </h3>
            <p className="mt-0.5 text-[12px] text-[#8a99b5]">
              {arcadeOn
                ? "Habilitado: el grupo puede jugar los minijuegos y competir en el ranking."
                : "Pausado: el orbe se ve dormido. Los récords y cristales quedan guardados."}
            </p>
          </div>
          <Button
            variant={arcadeOn ? "secondary" : "primary"}
            onClick={() => void toggleArcade()}
            loading={arcadeSaving}
          >
            {arcadeOn ? "Pausar" : "Habilitar"}
          </Button>
        </div>
      )}
    </Card>
  );
}
