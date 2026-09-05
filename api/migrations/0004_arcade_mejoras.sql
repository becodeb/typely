-- Mejoras permanentes por nivel en Tormenta de palabras (2026-09-05).
-- Diseño: artefacto "Mejoras de Tormenta"; arte: Images/orbita/ORBITA.md §7.6.
--
-- Los siete poderes que caían al azar se reemplazaron por trece mejoras que
-- el alumno ELIGE al subir de nivel y se quedan toda la partida. Dos de
-- ellas (bala extra y golpe crítico) destruyen palabras que el alumno no
-- tipeó, y eso cambia lo que el servidor escéptico tiene que saber de una
-- partida para creerle:
--
--   words_typed  las palabras que el alumno TIPEÓ. `words_destroyed` ahora
--                cuenta también las arrastradas por bala o crítico. Los
--                cristales se acuñan sobre lo tipeado, nunca sobre lo que
--                cayó de regalo.
--   level        el nivel alcanzado (cuántas cartas eligió).
--   upgrades     la build: JSON [{ "id": "bala", "level": 2 }, …]. Texto y
--                no jsonb, mismo criterio que owned_cosmetics y audit_log.meta.
--
-- Las tres tienen DEFAULT: las filas viejas y las colas guardadas en un
-- navegador antes de este deploy siguen entrando sin tocarlas.

ALTER TABLE arcade_runs
  ADD COLUMN words_typed integer  NOT NULL DEFAULT 0,
  ADD COLUMN level       smallint NOT NULL DEFAULT 0,
  ADD COLUMN upgrades    text     NOT NULL DEFAULT '[]';

-- Antes de las mejoras no existía la bala: todo lo destruido se tipeó.
UPDATE arcade_runs SET words_typed = words_destroyed;
