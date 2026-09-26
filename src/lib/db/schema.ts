import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    title: text("title"),
    passwordHash: text("password_hash").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  }),
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => ({
    tokenIdx: uniqueIndex("sessions_token_idx").on(t.tokenHash),
    userIdx: index("sessions_user_idx").on(t.userId),
  }),
);

export const patients = sqliteTable(
  "patients",
  {
    id: text("id").primaryKey(),
    pid: text("pid").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    birthYear: integer("birth_year"),
    sex: text("sex"),
    conditionSummary: text("condition_summary"),
    consentStatus: text("consent_status").notNull().default("consented"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    pidIdx: uniqueIndex("patients_pid_idx").on(t.pid),
    ownerIdx: index("patients_owner_idx").on(t.ownerId),
  }),
);

export const researchPrograms = sqliteTable(
  "research_programs",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    hypothesis: text("hypothesis"),
    focusArea: text("focus_area"),
    status: text("status").notNull().default("active"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    patientIdx: index("research_programs_patient_idx").on(t.patientId),
  }),
);

export const dataRecords = sqliteTable(
  "data_records",
  {
    id: text("id").primaryKey(),
    programId: text("program_id")
      .notNull()
      .references(() => researchPrograms.id, { onDelete: "cascade" }),
    uploadedById: text("uploaded_by_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    category: text("category").notNull().default("other"),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    storagePath: text("storage_path"),
    description: text("description"),
    isSynthetic: integer("is_synthetic", { mode: "boolean" }).notNull().default(true),
    uploadedAt: integer("uploaded_at").notNull(),
  },
  (t) => ({
    programIdx: index("data_records_program_idx").on(t.programId),
  }),
);

export const researchActivities = sqliteTable(
  "research_activities",
  {
    id: text("id").primaryKey(),
    programId: text("program_id")
      .notNull()
      .references(() => researchPrograms.id, { onDelete: "cascade" }),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    activityType: text("activity_type").notNull().default("other"),
    description: text("description"),
    hypothesis: text("hypothesis"),
    status: text("status").notNull().default("planned"),
    startedAt: integer("started_at"),
    completedAt: integer("completed_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    programIdx: index("research_activities_program_idx").on(t.programId),
  }),
);

export const findings = sqliteTable(
  "findings",
  {
    id: text("id").primaryKey(),
    programId: text("program_id")
      .notNull()
      .references(() => researchPrograms.id, { onDelete: "cascade" }),
    activityId: text("activity_id").references(() => researchActivities.id, {
      onDelete: "set null",
    }),
    reportedById: text("reported_by_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull().default("other"),
    significance: text("significance").notNull().default("medium"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    programIdx: index("findings_program_idx").on(t.programId),
    activityIdx: index("findings_activity_idx").on(t.activityId),
  }),
);

export const evidence = sqliteTable(
  "evidence",
  {
    id: text("id").primaryKey(),
    findingId: text("finding_id")
      .notNull()
      .references(() => findings.id, { onDelete: "cascade" }),
    addedById: text("added_by_id")
      .notNull()
      .references(() => users.id),
    sourceType: text("source_type").notNull().default("other"),
    title: text("title").notNull(),
    url: text("url"),
    doi: text("doi"),
    note: text("note"),
    attachmentDataRecordId: text("attachment_data_record_id").references(() => dataRecords.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    findingIdx: index("evidence_finding_idx").on(t.findingId),
  }),
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    programId: text("program_id")
      .notNull()
      .references(() => researchPrograms.id, { onDelete: "cascade" }),
    generatedById: text("generated_by_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    status: text("status").notNull().default("draft"),
    summary: text("summary"),
    contentJson: text("content_json"),
    createdAt: integer("created_at").notNull(),
    finalizedAt: integer("finalized_at"),
  },
  (t) => ({
    programIdx: index("reports_program_idx").on(t.programId),
  }),
);

export const historyEvents = sqliteTable(
  "history_events",
  {
    id: text("id").primaryKey(),
    programId: text("program_id")
      .notNull()
      .references(() => researchPrograms.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    metadataJson: text("metadata_json"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    programIdx: index("history_events_program_idx").on(t.programId),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type ResearchProgram = typeof researchPrograms.$inferSelect;
export type DataRecord = typeof dataRecords.$inferSelect;
export type ResearchActivity = typeof researchActivities.$inferSelect;
export type Finding = typeof findings.$inferSelect;
export type Evidence = typeof evidence.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type HistoryEvent = typeof historyEvents.$inferSelect;
