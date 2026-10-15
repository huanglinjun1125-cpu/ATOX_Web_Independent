CREATE TABLE "event_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"captain_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"track_id" text NOT NULL,
	"skills" text NOT NULL,
	"recruitment" text NOT NULL,
	"capacity" integer NOT NULL,
	"recruiting" boolean DEFAULT true NOT NULL,
	"dissolved" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_teams_id_event_unique" UNIQUE("id","event_id"),
	CONSTRAINT "event_teams_capacity_valid" CHECK ("event_teams"."capacity" >= 2 AND "event_teams"."capacity" <= 20)
);
--> statement-breakpoint
CREATE TABLE "team_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"skills" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "team_members_event_user_unique" UNIQUE("event_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "event_teams" ADD CONSTRAINT "event_teams_captain_id_users_id_fk" FOREIGN KEY ("captain_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_applications" ADD CONSTRAINT "team_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_applications" ADD CONSTRAINT "team_applications_team_id_event_id_event_teams_id_event_id_fk" FOREIGN KEY ("team_id","event_id") REFERENCES "public"."event_teams"("id","event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_event_id_event_teams_id_event_id_fk" FOREIGN KEY ("team_id","event_id") REFERENCES "public"."event_teams"("id","event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_teams_event_idx" ON "event_teams" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_applications_pending_unique" ON "team_applications" USING btree ("event_id","user_id") WHERE "team_applications"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "team_applications_event_idx" ON "team_applications" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "team_members_team_idx" ON "team_members" USING btree ("team_id");