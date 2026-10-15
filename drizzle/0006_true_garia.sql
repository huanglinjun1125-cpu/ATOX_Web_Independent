CREATE TABLE "business_audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor" jsonb NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"event_id" text,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "business_audit_resource_idx" ON "business_audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "business_audit_created_idx" ON "business_audit_logs" USING btree ("created_at");