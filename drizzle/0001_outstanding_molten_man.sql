CREATE TABLE "event_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"original_name" text NOT NULL,
	"storage_name" text NOT NULL,
	"media_type" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_assets_storage_name_unique" UNIQUE("storage_name")
);
--> statement-breakpoint
CREATE TABLE "event_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"official" jsonb,
	"draft" jsonb,
	"revision" integer DEFAULT 0 NOT NULL,
	"submitted_revision" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'not_submitted' NOT NULL,
	"result" text,
	"public_note" text,
	"internal_note" text,
	"processed_by" uuid,
	"processed_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_materials_event_user_unique" UNIQUE("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"country" text NOT NULL,
	"organization" text DEFAULT '' NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"accepted_terms" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_registrations_event_user_unique" UNIQUE("event_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "event_assets" ADD CONSTRAINT "event_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_materials" ADD CONSTRAINT "event_materials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_materials" ADD CONSTRAINT "event_materials_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_assets_event_user_idx" ON "event_assets" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "event_assets_user_id_idx" ON "event_assets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_materials_user_id_idx" ON "event_materials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_materials_event_status_idx" ON "event_materials" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "event_materials_processed_by_idx" ON "event_materials" USING btree ("processed_by");--> statement-breakpoint
CREATE INDEX "event_registrations_user_id_idx" ON "event_registrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_registrations_event_created_at_idx" ON "event_registrations" USING btree ("event_id","created_at");