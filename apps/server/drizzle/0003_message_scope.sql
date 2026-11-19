ALTER TABLE "messages" ADD COLUMN "scope" text;--> statement-breakpoint
DELETE FROM "messages" WHERE "kind" = 'system';   -- the old game lines had no scope: removed (the players' messages stay)
