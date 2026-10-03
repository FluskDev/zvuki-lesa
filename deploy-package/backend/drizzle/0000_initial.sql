CREATE TYPE "public"."booking_source" AS ENUM('site', 'manual');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('new', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."cottage_image_section" AS ENUM('main', 'interior', 'kitchen', 'bathroom', 'amenities');--> statement-breakpoint
CREATE TYPE "public"."price_rule_modifier" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."review_source" AS ENUM('2gis', 'yandex', 'google', 'manual');--> statement-breakpoint
CREATE TABLE "amenities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"event_type" text NOT NULL,
	"page" text,
	"label" text,
	"referrer" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"body" text NOT NULL,
	"cover_image" text,
	"author" text DEFAULT 'Команда Звуки Леса' NOT NULL,
	"category" text NOT NULL,
	"reading_time_min" integer DEFAULT 5 NOT NULL,
	"schema_json" text NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "booking_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price_at_booking" integer
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"cottage_id" integer NOT NULL,
	"guest_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"check_in_date" date NOT NULL,
	"check_out_date" date NOT NULL,
	"guests" integer NOT NULL,
	"notes" text,
	"nights" integer NOT NULL,
	"subtotal" integer NOT NULL,
	"services_total" integer DEFAULT 0 NOT NULL,
	"total_price" integer NOT NULL,
	"status" "booking_status" DEFAULT 'new' NOT NULL,
	"source" "booking_source" DEFAULT 'site' NOT NULL,
	"manager_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cottage_amenities" (
	"cottage_id" integer NOT NULL,
	"amenity_id" integer NOT NULL,
	CONSTRAINT "cottage_amenities_cottage_id_amenity_id_pk" PRIMARY KEY("cottage_id","amenity_id")
);
--> statement-breakpoint
CREATE TABLE "cottage_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"cottage_id" integer NOT NULL,
	"url" text NOT NULL,
	"section" "cottage_image_section" DEFAULT 'interior' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cottages" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"map_id" text NOT NULL,
	"name" text NOT NULL,
	"short_description" text NOT NULL,
	"long_description" text NOT NULL,
	"description" text,
	"house_rules" text,
	"base_price" integer NOT NULL,
	"area" integer NOT NULL,
	"guests" integer NOT NULL,
	"bedrooms" integer NOT NULL,
	"beds_double" integer DEFAULT 0 NOT NULL,
	"beds_single" integer DEFAULT 0 NOT NULL,
	"check_in_time" text NOT NULL,
	"check_out_time" text NOT NULL,
	"main_image" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cottages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "images_registry" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"alt" text NOT NULL,
	"caption" text,
	"width" integer,
	"height" integer,
	"uploaded_by" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "images_registry_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "max_subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"chat_id" text,
	"join_code" text NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	"last_notified_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "max_subscribers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"booking_id" integer,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "price_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"cottage_id" integer,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"modifier_type" "price_rule_modifier" NOT NULL,
	"modifier_value" integer NOT NULL,
	"weekend_modifier" integer,
	"priority" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recreation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"cottage_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"photo" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_name" text NOT NULL,
	"rating" integer NOT NULL,
	"text" text NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "review_source" DEFAULT 'manual' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"h1" text NOT NULL,
	"body" text NOT NULL,
	"meta_image" text,
	"intent" text NOT NULL,
	"schema_json" text NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"priority" double precision DEFAULT 0.7 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seo_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"base_price" integer,
	"icon" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cottage_id_cottages_id_fk" FOREIGN KEY ("cottage_id") REFERENCES "public"."cottages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cottage_amenities" ADD CONSTRAINT "cottage_amenities_cottage_id_cottages_id_fk" FOREIGN KEY ("cottage_id") REFERENCES "public"."cottages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cottage_amenities" ADD CONSTRAINT "cottage_amenities_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cottage_images" ADD CONSTRAINT "cottage_images_cottage_id_cottages_id_fk" FOREIGN KEY ("cottage_id") REFERENCES "public"."cottages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_cottage_id_cottages_id_fk" FOREIGN KEY ("cottage_id") REFERENCES "public"."cottages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recreation_items" ADD CONSTRAINT "recreation_items_cottage_id_cottages_id_fk" FOREIGN KEY ("cottage_id") REFERENCES "public"."cottages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_analytics_events_created_at" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_analytics_events_session" ON "analytics_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_blog_posts_published_published_at" ON "blog_posts" USING btree ("is_published","published_at");--> statement-breakpoint
CREATE INDEX "idx_booking_services_booking" ON "booking_services" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_cottage" ON "bookings" USING btree ("cottage_id","check_in_date","check_out_date");--> statement-breakpoint
CREATE INDEX "idx_bookings_status" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cottage_images_cottage_section" ON "cottage_images" USING btree ("cottage_id","section","position");--> statement-breakpoint
CREATE INDEX "idx_price_rules_dates" ON "price_rules" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_seo_pages_published_priority" ON "seo_pages" USING btree ("is_published","priority");