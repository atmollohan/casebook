CREATE TABLE `data_records` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`uploaded_by_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`storage_path` text,
	`description` text,
	`is_synthetic` integer DEFAULT true NOT NULL,
	`uploaded_at` integer NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `research_programs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `data_records_program_idx` ON `data_records` (`program_id`);--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`finding_id` text NOT NULL,
	`added_by_id` text NOT NULL,
	`source_type` text DEFAULT 'other' NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`doi` text,
	`note` text,
	`attachment_data_record_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`finding_id`) REFERENCES `findings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`attachment_data_record_id`) REFERENCES `data_records`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `evidence_finding_idx` ON `evidence` (`finding_id`);--> statement-breakpoint
CREATE TABLE `findings` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`activity_id` text,
	`reported_by_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`significance` text DEFAULT 'medium' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `research_programs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `research_activities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reported_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `findings_program_idx` ON `findings` (`program_id`);--> statement-breakpoint
CREATE INDEX `findings_activity_idx` ON `findings` (`activity_id`);--> statement-breakpoint
CREATE TABLE `history_events` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`actor_id` text,
	`event_type` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`summary` text NOT NULL,
	`metadata_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `research_programs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `history_events_program_idx` ON `history_events` (`program_id`);--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`pid` text NOT NULL,
	`owner_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`birth_year` integer,
	`sex` text,
	`condition_summary` text,
	`consent_status` text DEFAULT 'consented' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patients_pid_idx` ON `patients` (`pid`);--> statement-breakpoint
CREATE INDEX `patients_owner_idx` ON `patients` (`owner_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`generated_by_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`summary` text,
	`content_json` text,
	`created_at` integer NOT NULL,
	`finalized_at` integer,
	FOREIGN KEY (`program_id`) REFERENCES `research_programs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`generated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reports_program_idx` ON `reports` (`program_id`);--> statement-breakpoint
CREATE TABLE `research_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`created_by_id` text NOT NULL,
	`title` text NOT NULL,
	`activity_type` text DEFAULT 'other' NOT NULL,
	`description` text,
	`hypothesis` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `research_programs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `research_activities_program_idx` ON `research_activities` (`program_id`);--> statement-breakpoint
CREATE TABLE `research_programs` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`hypothesis` text,
	`focus_area` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `research_programs_patient_idx` ON `research_programs` (`patient_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_idx` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`title` text,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);