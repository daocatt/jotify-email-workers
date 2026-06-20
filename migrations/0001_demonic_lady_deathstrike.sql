CREATE INDEX `account_user_id_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE INDEX `destinations_user_id_idx` ON `destinations` (`userId`);--> statement-breakpoint
CREATE INDEX `domains_user_id_idx` ON `domains` (`userId`);--> statement-breakpoint
CREATE INDEX `forward_rules_user_id_idx` ON `forward_rules` (`userId`);--> statement-breakpoint
CREATE INDEX `forward_rules_domain_id_idx` ON `forward_rules` (`domainId`);--> statement-breakpoint
CREATE INDEX `forward_rules_destination_id_idx` ON `forward_rules` (`destinationId`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `webhook_rules_user_id_idx` ON `webhook_rules` (`userId`);--> statement-breakpoint
CREATE INDEX `webhook_rules_domain_id_idx` ON `webhook_rules` (`domainId`);--> statement-breakpoint
CREATE INDEX `webhook_rules_webhook_id_idx` ON `webhook_rules` (`webhookId`);--> statement-breakpoint
CREATE INDEX `webhooks_user_id_idx` ON `webhooks` (`userId`);