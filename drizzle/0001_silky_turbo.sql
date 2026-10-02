-- Phase 5: the generalized data model. `patients` becomes `cases`, and a case is a
-- subject of study rather than a person.
--
-- This migration is hand-written, deliberately. drizzle-kit generates the structural
-- change as "create `cases`, drop `patients`", which discards every existing row, and it
-- cannot infer the data movement at all. The steps below are the ones that preserve an
-- instance's data. The generated snapshot and journal entry are unchanged, so future
-- `npm run db:generate` runs still diff correctly.
--
-- Only ALTER TABLE statements are used here, never CREATE or DROP TABLE. The migrator runs
-- each migration inside an explicit transaction (drizzle-orm sqlite-core dialect), and
-- `PRAGMA foreign_keys = OFF` is a no-op inside a transaction — so dropping `cases` here
-- would cascade and delete every `research_programs` row. Renaming and adding columns does
-- not touch referential integrity, so it is safe.
--
-- `title` is added as NOT NULL with an empty-string default, which is the only way SQLite
-- allows a NOT NULL column to be added to a table that already has rows. The backfill below
-- overwrites it for every migrated row. Server actions validate a non-empty title before
-- writing, so the default is a backstop for raw SQL, not a supported value.

ALTER TABLE `patients` RENAME TO `cases`;--> statement-breakpoint
ALTER TABLE `cases` RENAME COLUMN `pid` TO `code`;--> statement-breakpoint
ALTER TABLE `cases` RENAME COLUMN `condition_summary` TO `summary`;--> statement-breakpoint
ALTER TABLE `research_programs` RENAME COLUMN `patient_id` TO `case_id`;--> statement-breakpoint
ALTER TABLE `cases` ADD COLUMN `title` text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `cases` ADD COLUMN `subtitle` text;--> statement-breakpoint
ALTER TABLE `cases` ADD COLUMN `kind` text DEFAULT 'subject' NOT NULL;--> statement-breakpoint
ALTER TABLE `cases` ADD COLUMN `attributes_json` text;--> statement-breakpoint

-- The two name columns become a single display name. The last name is not carried over as a
-- subtitle: for a migrated subject the distinguishing detail is the condition, which is
-- already in `summary`.
UPDATE `cases`
SET `title` = TRIM(COALESCE(`first_name`, '') || ' ' || COALESCE(`last_name`, ''));--> statement-breakpoint

-- The clinical columns become owner-supplied attributes, so nothing recorded before the
-- migration is lost. Keys are the human labels used to read them, and the old vocabularies
-- are mapped to the labels the UI showed. `birth_year` is cast to text because attributes are
-- string-valued by contract, and the condition is left in `summary` rather than copied here —
-- it is already carried over, and a fact stored in two places is a fact that can disagree.
UPDATE `cases`
SET `attributes_json` = json_object(
  'Birth year', CAST(`birth_year` AS text),
  'Sex', CASE `sex`
    WHEN 'female' THEN 'Female'
    WHEN 'male' THEN 'Male'
    WHEN 'unknown' THEN 'Not specified'
    ELSE `sex`
  END,
  'Consent status', CASE `consent_status`
    WHEN 'consented' THEN 'Consent on file'
    WHEN 'deidentified' THEN 'Deidentified cohort'
    WHEN 'consent_pending' THEN 'Consent pending'
    ELSE `consent_status`
  END
);--> statement-breakpoint

-- json_object materializes every key, including the ones whose value is null. Strip those,
-- so a case carries only the facts that were actually recorded. Each removal is conditional
-- on the source column being null, so a real value is never dropped.
UPDATE `cases` SET `attributes_json` = json_remove(`attributes_json`, '$.Birth year')
WHERE `birth_year` IS NULL;--> statement-breakpoint
UPDATE `cases` SET `attributes_json` = json_remove(`attributes_json`, '$.Sex')
WHERE `sex` IS NULL;--> statement-breakpoint

-- Keep the numeric part of every existing code so a code printed on an older report still
-- resolves; only the letter that named the old entity changes.
UPDATE `cases` SET `code` = 'CB-C-' || SUBSTR(`code`, 6) WHERE `code` LIKE 'CB-P-%';--> statement-breakpoint

ALTER TABLE `cases` DROP COLUMN `first_name`;--> statement-breakpoint
ALTER TABLE `cases` DROP COLUMN `last_name`;--> statement-breakpoint
ALTER TABLE `cases` DROP COLUMN `birth_year`;--> statement-breakpoint
ALTER TABLE `cases` DROP COLUMN `sex`;--> statement-breakpoint
ALTER TABLE `cases` DROP COLUMN `consent_status`;--> statement-breakpoint

-- Indexes keep their old names across a table rename, so they are replaced under the names
-- the schema declares.
DROP INDEX IF EXISTS `patients_pid_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `patients_owner_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `cases_code_idx` ON `cases` (`code`);--> statement-breakpoint
CREATE INDEX `cases_owner_idx` ON `cases` (`owner_id`);--> statement-breakpoint
DROP INDEX IF EXISTS `research_programs_patient_idx`;--> statement-breakpoint
CREATE INDEX `research_programs_case_idx` ON `research_programs` (`case_id`);
