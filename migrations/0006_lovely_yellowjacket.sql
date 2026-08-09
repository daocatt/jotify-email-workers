ALTER TABLE `failed_webhooks` ADD `deliveryId` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `failed_webhooks_delivery_id_unique_idx` ON `failed_webhooks` (`deliveryId`);