ALTER TABLE `forward_rules` ADD `enabled` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `webhook_rules` ADD `enabled` integer DEFAULT 1 NOT NULL;
