ALTER TABLE `invitation` ADD `max_uses` integer;--> statement-breakpoint
ALTER TABLE `invitation` ADD `use_count` integer NOT NULL DEFAULT 0;
