/* Schema Drizzle — espeja `api/migrations/*.sql`, que es la fuente de
   verdad. Este archivo existe para que la API haga queries tipadas.
   Si tocás una migración, actualizá esto en el mismo commit.

   Nota sobre `citext`: Drizzle no tiene un tipo propio, así que `username`
   y `email` se declaran como `text`. En la base son citext, de modo que
   las comparaciones ya son insensibles a mayúsculas del lado del servidor
   y no hace falta ningún lower() en las queries. */

import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  smallint,
  bigserial,
  timestamp,
  date,
  index,
  primaryKey,
  pgEnum,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "superadmin",
  "admin",
  "docente",
  "alumno",
]);

export const gradeEnum = pgEnum("grade_id", [
  "inicial",
  "1ep",
  "2ep",
  "3ep",
  "4ep",
  "5ep",
  "6ep",
  "sec",
  "libre",
]);

export const sedes = pgTable("sedes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  city: text("city").notNull().default("Sin localidad"),
  photo: text("photo"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* El "curso" de la escuela. Ex `classes`. */
export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sedeId: uuid("sede_id")
      .notNull()
      .references(() => sedes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    grade: gradeEnum("grade").notNull().default("libre"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sedeIdx: index("idx_groups_sede").on(t.sedeId),
  }),
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: userRoleEnum("role").notNull(),
    sedeId: uuid("sede_id").references(() => sedes.id, { onDelete: "set null" }),
    /* Un alumno pertenece a UN grupo. Para docentes/admins es siempre null
       (lo fuerza un CHECK en la base). */
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
    /* Identidad primaria: la tienen todos, incluido el alumno sin email. */
    username: text("username").notNull(),
    /* Opcional: solo para Google sign-in y recuperación de cuenta. */
    email: text("email"),
    passwordHash: text("password_hash"),
    googleSub: text("google_sub"),
    fullName: text("full_name").notNull(),
    active: boolean("active").notNull().default(true),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    /* Borrado lógico. El login y todos los listados lo filtran. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sedeRoleIdx: index("idx_users_sede_role").on(t.sedeId, t.role),
    groupIdx: index("idx_users_group").on(t.groupId),
    roleIdx: index("idx_users_role").on(t.role),
  }),
);

/* Un docente puede estar a cargo de varios grupos, y un grupo puede tener
   varios docentes. */
export const groupTeachers = pgTable(
  "group_teachers",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.groupId, t.userId] }),
    userIdx: index("idx_group_teachers_user").on(t.userId),
  }),
);

/* Islas habilitadas por el docente para un grupo. Sin filas = todas las
   del grado. Esta tabla es la ÚNICA fuente de verdad: el alumno la lee
   desde la API, no desde localStorage. */
export const groupWorlds = pgTable(
  "group_worlds",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    worldId: text("world_id").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.groupId, t.worldId] }),
  }),
);

export const levelProgress = pgTable(
  "level_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    worldId: text("world_id").notNull(),
    levelNumber: integer("level_number").notNull(),
    completed: boolean("completed").notNull().default(true),
    bestAccuracy: smallint("best_accuracy").notNull(),
    bestWpm: smallint("best_wpm"),
    attempts: integer("attempts").notNull().default(1),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.worldId, t.levelNumber] }),
    userIdx: index("idx_level_progress_user").on(t.userId),
  }),
);

/* Particionada por mes en `ended_at`. Las particiones las crea
   `ensure_attempts_partitions()` en cada arranque de la API. */
export const attempts = pgTable(
  "attempts",
  {
    id: bigserial("id", { mode: "bigint" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    worldId: text("world_id").notNull(),
    levelNumber: integer("level_number").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    accuracy: smallint("accuracy").notNull(),
    wpm: smallint("wpm"),
    errorCount: integer("error_count").notNull().default(0),
    completed: boolean("completed").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.id, t.endedAt] }),
    userTimeIdx: index("idx_attempts_user_time").on(t.userId, t.endedAt),
  }),
);

export const studentStats = pgTable("student_stats", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  xp: integer("xp").notNull().default(0),
  stars: integer("stars").notNull().default(0),
  levelsCompleted: integer("levels_completed").notNull().default(0),
  streakDays: integer("streak_days").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActiveDay: date("last_active_day"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentAchievements = pgTable(
  "student_achievements",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id").notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.achievementId] }) }),
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    userIdx: index("idx_refresh_user").on(t.userId),
  }),
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    sedeId: uuid("sede_id").references(() => sedes.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    meta: text("meta"), // JSON serializado; barato y evita migrar a jsonb
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    atIdx: index("idx_audit_at").on(t.at),
    sedeIdx: index("idx_audit_sede").on(t.sedeId),
    entityIdx: index("idx_audit_entity").on(t.entityType, t.entityId),
    actorIdx: index("idx_audit_actor").on(t.actorId),
  }),
);

export type Role = (typeof userRoleEnum.enumValues)[number];
export type Grade = (typeof gradeEnum.enumValues)[number];

export type DbUser = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type DbSede = typeof sedes.$inferSelect;
export type DbGroup = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type DbLevelProgress = typeof levelProgress.$inferSelect;
export type NewLevelProgress = typeof levelProgress.$inferInsert;
export type DbAttempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;
