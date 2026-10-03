CREATE TABLE "site_map_elements" (
	"map_id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"photo_url" text,
	"has_button" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
