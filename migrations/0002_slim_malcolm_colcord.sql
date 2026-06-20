CREATE TABLE `failed_webhooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`webhookId` integer NOT NULL,
	`url` text NOT NULL,
	`headers` text NOT NULL,
	`payload` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`webhookId`) REFERENCES `webhooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `failed_webhooks_user_id_idx` ON `failed_webhooks` (`userId`);--> statement-breakpoint
CREATE INDEX `failed_webhooks_webhook_id_idx` ON `failed_webhooks` (`webhookId`);