CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` text NOT NULL,
	`actor_role` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text,
	`target_email` text,
	`detail` text,
	`ip` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_actor_id_idx` ON `audit_log` (`actor_id`);--> statement-breakpoint
CREATE INDEX `audit_log_created_at_idx` ON `audit_log` (`createdAt`);--> statement-breakpoint
CREATE TABLE `code_attempts` (
	`identifier` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expiresAt` integer NOT NULL
);
