CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"actor" jsonb NOT NULL,
	"target_user_id" uuid NOT NULL,
	"target_email" text NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "admin_audit_action_valid" CHECK ("admin_audit_logs"."action" IN ('bootstrap','grant','update'))
);
--> statement-breakpoint
CREATE TABLE "administrators" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" jsonb NOT NULL,
	CONSTRAINT "administrators_email_unique" UNIQUE("email"),
	CONSTRAINT "administrators_role_valid" CHECK ("administrators"."role" IN ('super_admin','operator')),
	CONSTRAINT "administrators_revision_positive" CHECK ("administrators"."revision">0)
);
--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "administrators" ADD CONSTRAINT "administrators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_audit_single_bootstrap" ON "admin_audit_logs" USING btree ("action") WHERE "admin_audit_logs"."action"='bootstrap';--> statement-breakpoint
CREATE INDEX "admin_audit_created_idx" ON "admin_audit_logs" USING btree ("created_at");