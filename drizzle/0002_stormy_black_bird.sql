CREATE TABLE "mock_payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mock_payment_transactions_attempt_id_unique" UNIQUE("attempt_id"),
	CONSTRAINT "mock_payment_transactions_nonnegative_amount" CHECK ("mock_payment_transactions"."amount" >= 0),
	CONSTRAINT "mock_payment_transactions_state_valid" CHECK ("mock_payment_transactions"."state" IN ('pending', 'succeeded', 'failed', 'cancelled', 'closed', 'unknown'))
);
--> statement-breakpoint
CREATE TABLE "ticket_inventory" (
	"event_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"total" integer NOT NULL,
	"sold" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_inventory_event_ticket_unique" UNIQUE("event_id","ticket_id"),
	CONSTRAINT "ticket_inventory_nonnegative" CHECK ("ticket_inventory"."total" >= 0 AND "ticket_inventory"."sold" >= 0 AND "ticket_inventory"."reserved" >= 0),
	CONSTRAINT "ticket_inventory_capacity" CHECK ("ticket_inventory"."sold" + "ticket_inventory"."reserved" <= "ticket_inventory"."total")
);
--> statement-breakpoint
CREATE TABLE "ticket_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"quantity" integer NOT NULL,
	"currency" text NOT NULL,
	"unit_amount" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"answers" jsonb NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"quote_version" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"close_reason" text,
	"reconciliation_required" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ticket_orders_user_event_idempotency_unique" UNIQUE("user_id","event_id","idempotency_key"),
	CONSTRAINT "ticket_orders_positive_quantity" CHECK ("ticket_orders"."quantity" > 0),
	CONSTRAINT "ticket_orders_nonnegative_amounts" CHECK ("ticket_orders"."unit_amount" >= 0 AND "ticket_orders"."total_amount" >= 0),
	CONSTRAINT "ticket_orders_status_valid" CHECK ("ticket_orders"."status" IN ('pending', 'paid', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "ticket_payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider_transaction_id" text,
	"status" text DEFAULT 'creating' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"failure_code" text,
	CONSTRAINT "ticket_payment_attempts_provider_transaction_id_unique" UNIQUE("provider_transaction_id"),
	CONSTRAINT "ticket_payment_attempts_status_valid" CHECK ("ticket_payment_attempts"."status" IN ('creating', 'pending', 'succeeded', 'failed', 'cancelled', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "ticket_payment_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"attempt_id" uuid NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "ticket_payment_notifications_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"status" text DEFAULT 'held' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_reservations_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "ticket_reservations_positive_quantity" CHECK ("ticket_reservations"."quantity" > 0),
	CONSTRAINT "ticket_reservations_status_valid" CHECK ("ticket_reservations"."status" IN ('held', 'converted', 'released'))
);
--> statement-breakpoint
ALTER TABLE "mock_payment_transactions" ADD CONSTRAINT "mock_payment_transactions_attempt_id_ticket_payment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."ticket_payment_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_payment_transactions" ADD CONSTRAINT "mock_payment_transactions_order_id_ticket_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ticket_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_orders" ADD CONSTRAINT "ticket_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_payment_attempts" ADD CONSTRAINT "ticket_payment_attempts_order_id_ticket_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ticket_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_payment_notifications" ADD CONSTRAINT "ticket_payment_notifications_attempt_id_ticket_payment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."ticket_payment_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_reservations" ADD CONSTRAINT "ticket_reservations_order_id_ticket_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ticket_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mock_payment_transactions_order_idx" ON "mock_payment_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_orders_user_event_pending_unique" ON "ticket_orders" USING btree ("user_id","event_id") WHERE "ticket_orders"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "ticket_orders_status_expiry_idx" ON "ticket_orders" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "ticket_orders_user_created_idx" ON "ticket_orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ticket_payment_attempts_order_created_idx" ON "ticket_payment_attempts" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "ticket_payment_notifications_attempt_idx" ON "ticket_payment_notifications" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "ticket_reservations_status_expiry_idx" ON "ticket_reservations" USING btree ("status","expires_at");