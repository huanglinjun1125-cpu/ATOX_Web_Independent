CREATE TABLE "managed_content" (
	"kind" text NOT NULL,
	"id" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"draft" jsonb NOT NULL,
	"live" jsonb,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "managed_content_kind_id_pk" PRIMARY KEY("kind","id"),
	CONSTRAINT "managed_content_kind" CHECK ("managed_content"."kind" in ('event', 'homepage')),
	CONSTRAINT "managed_content_state" CHECK ("managed_content"."state" in ('draft', 'published', 'withdrawn')),
	CONSTRAINT "managed_content_revision" CHECK ("managed_content"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "managed_content" ADD CONSTRAINT "managed_content_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;