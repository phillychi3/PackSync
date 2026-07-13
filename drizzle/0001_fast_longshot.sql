CREATE TABLE `bill_item` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_id` text NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`notes` text,
	`participants` text,
	FOREIGN KEY (`bill_id`) REFERENCES `bill`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bill_item_bill_idx` ON `bill_item` (`bill_id`);--> statement-breakpoint
ALTER TABLE `settlement` ADD `bill_id` text REFERENCES bill(id);