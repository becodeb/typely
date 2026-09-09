-- Un récord por juego; el perfil mantiene los campos históricos de Tormenta.
CREATE TABLE arcade_bests (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id text NOT NULL,
  best_score integer NOT NULL DEFAULT 0,
  best_wpm smallint NOT NULL DEFAULT 0,
  best_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id)
);
ALTER TABLE arcade_runs ADD COLUMN text_id text;
INSERT INTO arcade_bests (user_id, game_id, best_score, best_wpm)
  SELECT user_id, 'tormenta', best_score, 0 FROM arcade_profile ON CONFLICT DO NOTHING;
