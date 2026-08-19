CREATE TABLE `oauth_states` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` enum('google-drive') NOT NULL,
	`stateHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `oauth_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauth_states_stateHash_unique` UNIQUE(`stateHash`)
);
