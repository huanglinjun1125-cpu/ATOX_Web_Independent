CREATE TABLE "ticket_order_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"key" text NOT NULL,
	"order_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_order_keys_user_event_key_unique" UNIQUE("user_id","event_id","key")
);
--> statement-breakpoint
ALTER TABLE "ticket_order_keys" ADD CONSTRAINT "ticket_order_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_order_keys" ADD CONSTRAINT "ticket_order_keys_order_id_ticket_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ticket_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_order_keys_order_idx" ON "ticket_order_keys" USING btree ("order_id");