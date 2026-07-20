ALTER TABLE `invitation` ADD `max_uses` integer;--> statement-breakpoint
ALTER TABLE `invitation` ADD `use_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invitation` DROP COLUMN `used_at`;--> statement-breakpoint
ALTER TABLE `invitation` DROP COLUMN `used_by`;