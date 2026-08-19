CREATE TABLE `artifacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`kind` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` text NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`durationMs` int,
	`transcript` text,
	`transcriptState` enum('saved','needs-review') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `artifacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `device_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deviceKey` varchar(128) NOT NULL,
	`label` varchar(120) NOT NULL,
	`platform` varchar(32) NOT NULL,
	`status` enum('pending','linked','revoked') NOT NULL,
	`pairingTokenHash` varchar(128) NOT NULL,
	`pairingExpiresAt` timestamp NOT NULL,
	`lastSeenAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `device_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `device_links_pairingTokenHash_unique` UNIQUE(`pairingTokenHash`)
);
