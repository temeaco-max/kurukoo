CREATE TABLE `storage_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` enum('google-drive') NOT NULL,
	`externalAccountId` varchar(255) NOT NULL,
	`accountEmail` varchar(320),
	`refreshTokenCiphertext` text NOT NULL,
	`folderId` varchar(255),
	`status` enum('connected','revoked','expired') NOT NULL,
	`scope` varchar(512) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastValidatedAt` timestamp,
	CONSTRAINT `storage_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `artifacts` ADD `storageProvider` enum('google-drive','kurukoo-managed') DEFAULT 'kurukoo-managed' NOT NULL;--> statement-breakpoint
ALTER TABLE `artifacts` ADD `storageStatus` enum('pending_upload','uploaded','verified','pending_external_storage','retrying','failed','expired') DEFAULT 'verified' NOT NULL;--> statement-breakpoint
ALTER TABLE `artifacts` ADD `externalObjectId` varchar(512);--> statement-breakpoint
ALTER TABLE `artifacts` ADD `connectionId` int;