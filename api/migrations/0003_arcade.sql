-- Modo Órbita (arcade) — perfiles, partidas y el interruptor del docente.
--
-- Tres piezas:
--
--   groups.arcade_enabled   el docente puede apagar el modo para su grupo,
--                           igual que ya elige qué islas habilita.
--
--   arcade_profile          una fila por alumno: alias de piloto, saldo de
--                           cristales, récords y cosméticos. El alias existe
--                           porque el ranking global cruza escuelas y son
--                           menores: nunca un nombre real en la tabla pública.
--
--   arcade_runs             una fila por partida, append-only. `ranked`
--                           dice si entra al ranking: una partida cuya
--                           telemetría no cierra (300 PPM sostenidos…) se
--                           GUARDA igual — es dato — pero no compite ni
--                           acuña cristales. `week_key` (ISO, lunes a
--                           domingo) es el índice del ranking semanal.
--
-- Sin partición por mes, a diferencia de `attempts`: el volumen esperado es
-- menor y el índice por (game_id, week_key) cubre las consultas calientes.
-- Si algún día pesa, se particiona con la misma receta de attempts.

ALTER TABLE groups
  ADD COLUMN arcade_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE arcade_profile (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  alias            text,
  alias_changed_at timestamptz,
  crystals_balance integer NOT NULL DEFAULT 0,
  best_score       integer NOT NULL DEFAULT 0,
  best_threat      smallint NOT NULL DEFAULT 0,
  best_rank        text,
  owned_cosmetics  text NOT NULL DEFAULT '[]',   -- JSON: string[] de ids
  equipped_trail   text,
  equipped_beam    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE arcade_runs (
  id              bigserial PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id         text NOT NULL,
  started_at      timestamptz NOT NULL,
  ended_at        timestamptz NOT NULL,
  duration_ms     integer NOT NULL,
  score           integer NOT NULL,
  peak_threat     smallint NOT NULL,
  rank_id         text NOT NULL,
  wpm_avg         smallint NOT NULL,
  wpm_peak        smallint NOT NULL,
  accuracy        smallint NOT NULL,
  words_destroyed integer NOT NULL,
  chars_typed     integer NOT NULL,
  errors          integer NOT NULL,
  crystals_earned integer NOT NULL DEFAULT 0,
  week_key        text NOT NULL,
  ranked          boolean NOT NULL DEFAULT true
);

CREATE INDEX idx_arcade_runs_user_time ON arcade_runs (user_id, ended_at DESC);
-- La consulta caliente del ranking: mejores puntajes de un juego en una
-- semana. El parcial sobre ranked evita cargar la basura no competitiva.
CREATE INDEX idx_arcade_runs_board
  ON arcade_runs (game_id, week_key, score DESC)
  WHERE ranked;
