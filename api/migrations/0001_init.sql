-- =====================================================================
-- TYPELY — esquema base del sistema de usuarios (rediseño 2026).
--
-- Cuatro roles: superadmin (plataforma), admin (una sede), docente
-- (sus grupos), alumno (él mismo).
--
-- Identidad primaria: `username`. El email es OPCIONAL — un alumno de
-- primaria no tiene, y el admin le entrega usuario + contraseña. El email
-- solo existe para quien inicia sesión con Google o necesita recuperar
-- la cuenta.
--
-- Un alumno pertenece a UN grupo (users.group_id). Un docente puede estar
-- a cargo de VARIOS grupos (group_teachers), y un grupo puede tener varios
-- docentes.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'docente', 'alumno');

CREATE TYPE grade_id AS ENUM (
  'inicial', '1ep', '2ep', '3ep', '4ep', '5ep', '6ep', 'sec', 'libre'
);

-- ---------------------------------------------------------------------
-- Sedes — cada escuela. Solo el superadmin las administra.
-- ---------------------------------------------------------------------
CREATE TABLE sedes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  city       text NOT NULL DEFAULT 'Sin localidad',
  photo      text,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sedes_active ON sedes (active) WHERE active;

-- ---------------------------------------------------------------------
-- Grupos — el "curso" de la escuela (4to B). Pertenece a una sede y
-- tiene un grado, del que se deriva qué islas ve el alumno.
-- El nombre es único dentro de la sede para que el import por CSV pueda
-- resolver "4to B" sin ambigüedad.
-- ---------------------------------------------------------------------
CREATE TABLE groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id    uuid NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
  name       text NOT NULL,
  grade      grade_id NOT NULL DEFAULT 'libre',
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX groups_sede_name_unique ON groups (sede_id, lower(name));
CREATE INDEX idx_groups_sede ON groups (sede_id);

-- ---------------------------------------------------------------------
-- Usuarios.
--
--  * username  — identidad primaria, obligatoria para todos.
--  * email     — opcional. UNIQUE deja pasar múltiples NULL, así que
--                cientos de alumnos sin email conviven sin problema.
--  * group_id  — solo tiene sentido para alumnos (un grupo por alumno);
--                se fuerza con un CHECK.
--  * deleted_at — borrado lógico; el login y los listados lo filtran.
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role          user_role NOT NULL,
  sede_id       uuid REFERENCES sedes(id) ON DELETE SET NULL,
  group_id      uuid REFERENCES groups(id) ON DELETE SET NULL,
  username      citext NOT NULL UNIQUE,
  email         citext UNIQUE,
  password_hash text,
  google_sub    text UNIQUE,
  full_name     text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  deleted_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- Solo un alumno pertenece a un grupo. Un docente se vincula por
  -- group_teachers; un admin, por sede.
  CONSTRAINT users_group_only_for_students
    CHECK (group_id IS NULL OR role = 'alumno'),

  -- Un admin o un docente SIEMPRE pertenecen a una sede. El superadmin
  -- no pertenece a ninguna (administra todas).
  CONSTRAINT users_sede_required_for_staff
    CHECK (role = 'superadmin' OR role = 'alumno' OR sede_id IS NOT NULL),
  CONSTRAINT users_superadmin_has_no_sede
    CHECK (role <> 'superadmin' OR sede_id IS NULL)
);
CREATE INDEX idx_users_sede_role ON users (sede_id, role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_group     ON users (group_id)     WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role      ON users (role)         WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- Docentes a cargo de un grupo (N:M).
-- ---------------------------------------------------------------------
CREATE TABLE group_teachers (
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX idx_group_teachers_user ON group_teachers (user_id);

-- ---------------------------------------------------------------------
-- Islas habilitadas por grupo (selección del docente). Sin filas para un
-- grupo = sin restricción: se ven todas las islas del grado.
-- ---------------------------------------------------------------------
CREATE TABLE group_worlds (
  group_id   uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  world_id   text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (group_id, world_id)
);

-- ---------------------------------------------------------------------
-- Progreso por nivel — una fila por (alumno, isla, nivel), con el mejor
-- resultado. La derivación de estrellas vive en el código compartido.
-- ---------------------------------------------------------------------
CREATE TABLE level_progress (
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  world_id        text NOT NULL,
  level_number    int  NOT NULL,
  completed       boolean NOT NULL DEFAULT true,
  best_accuracy   smallint NOT NULL CHECK (best_accuracy BETWEEN 0 AND 100),
  best_wpm        smallint,
  attempts        int NOT NULL DEFAULT 1,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, world_id, level_number)
);
CREATE INDEX idx_level_progress_user ON level_progress (user_id);

-- ---------------------------------------------------------------------
-- Intentos — bitácora append-only para analítica. Particionada por mes
-- para que borrar/archivar datos viejos sea barato.
-- ---------------------------------------------------------------------
CREATE TABLE attempts (
  id           bigserial,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  world_id     text NOT NULL,
  level_number int NOT NULL,
  started_at   timestamptz NOT NULL,
  ended_at     timestamptz NOT NULL,
  accuracy     smallint NOT NULL CHECK (accuracy BETWEEN 0 AND 100),
  wpm          smallint,
  error_count  int NOT NULL DEFAULT 0,
  completed    boolean NOT NULL,
  PRIMARY KEY (id, ended_at)
) PARTITION BY RANGE (ended_at);

CREATE INDEX idx_attempts_user_time ON attempts (user_id, ended_at DESC);

-- Partición de escape: nada se pierde si una fila cae fuera del rango
-- de las particiones mensuales existentes.
CREATE TABLE attempts_default PARTITION OF attempts DEFAULT;

-- Crea las particiones mensuales que falten, desde el mes actual hacia
-- adelante. Idempotente: la API la llama en cada arranque, así que la
-- ventana rueda sola y no depende de ningún cron que alguien se olvide.
CREATE OR REPLACE FUNCTION ensure_attempts_partitions(months_ahead int DEFAULT 6)
RETURNS void AS $fn$
DECLARE
  i       int;
  p_start date;
  p_end   date;
  p_name  text;
BEGIN
  FOR i IN 0..months_ahead LOOP
    p_start := (date_trunc('month', now()) + (i || ' months')::interval)::date;
    p_end   := (date_trunc('month', now()) + ((i + 1) || ' months')::interval)::date;
    p_name  := 'attempts_' || to_char(p_start, 'YYYYMM');
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = p_name) THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF attempts FOR VALUES FROM (%L) TO (%L)',
        p_name, p_start, p_end
      );
    END IF;
  END LOOP;
END;
$fn$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Gamificación — derivada de level_progress + attempts, persistida para
-- que los dashboards no la recalculen en cada lectura.
-- ---------------------------------------------------------------------
CREATE TABLE student_stats (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp               integer NOT NULL DEFAULT 0,
  stars            integer NOT NULL DEFAULT 0,
  levels_completed integer NOT NULL DEFAULT 0,
  streak_days      integer NOT NULL DEFAULT 0,
  longest_streak   integer NOT NULL DEFAULT 0,
  last_active_day  date,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE student_achievements (
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  unlocked_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

-- ---------------------------------------------------------------------
-- Refresh tokens — opacos, guardados hasheados y revocables. Los access
-- token son JWT y nunca tocan la base.
-- ---------------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  issued_at  timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX idx_refresh_user ON refresh_tokens (user_id) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------
-- Auditoría — append-only. Toda mutación privilegiada escribe una fila.
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  sede_id     uuid REFERENCES sedes(id) ON DELETE SET NULL,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text,
  meta        text,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_at     ON audit_log (at DESC);
CREATE INDEX idx_audit_sede   ON audit_log (sede_id);
CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_actor  ON audit_log (actor_id);

-- ---------------------------------------------------------------------
-- updated_at automático.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sedes_updated  BEFORE UPDATE ON sedes
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_groups_updated BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_users_updated  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
