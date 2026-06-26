CREATE TABLE `delivery_idempotency` (
	`idempotency_key` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `delivery_idempotency_created_at_idx` ON `delivery_idempotency` (`created_at`);
