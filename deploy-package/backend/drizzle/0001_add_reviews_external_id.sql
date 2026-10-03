ALTER TABLE "reviews" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE INDEX "idx_reviews_published_date" ON "reviews" USING btree ("is_published","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_reviews_source_external_id" ON "reviews" USING btree ("source","external_id") WHERE "reviews"."external_id" IS NOT NULL;