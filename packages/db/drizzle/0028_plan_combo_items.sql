ALTER TABLE "plan_version_items" DROP CONSTRAINT IF EXISTS "plan_version_items_sessions_positive";--> statement-breakpoint
ALTER TABLE "plan_version_items" DROP CONSTRAINT IF EXISTS "plan_version_items_duration_positive";--> statement-breakpoint
ALTER TABLE "plan_version_items" ALTER COLUMN "procedure_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_version_items" ALTER COLUMN "sessions" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_version_items" ALTER COLUMN "procedure_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_version_items" ALTER COLUMN "duration_minutes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_version_items" ALTER COLUMN "session_schema" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_version_items" ADD COLUMN IF NOT EXISTS "offer_type" text DEFAULT 'procedure' NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_version_items" ADD COLUMN IF NOT EXISTS "combo_id" uuid;--> statement-breakpoint
ALTER TABLE "plan_version_items" ADD COLUMN IF NOT EXISTS "combo_name" text;--> statement-breakpoint
ALTER TABLE "plan_version_items" ADD COLUMN IF NOT EXISTS "combo_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "plan_version_items" ADD CONSTRAINT "plan_version_items_tenant_combo_fk" FOREIGN KEY ("tenant_id","combo_id") REFERENCES "combos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_version_items" ADD CONSTRAINT "plan_version_items_offer_type_valid" CHECK ("plan_version_items"."offer_type" in ('procedure', 'combo'));--> statement-breakpoint
ALTER TABLE "plan_version_items" ADD CONSTRAINT "plan_version_items_offer_target_valid" CHECK (("plan_version_items"."offer_type" = 'procedure' and "plan_version_items"."procedure_id" is not null and "plan_version_items"."combo_id" is null and "plan_version_items"."sessions" >= 1 and "plan_version_items"."procedure_name" is not null and "plan_version_items"."duration_minutes" >= 1 and "plan_version_items"."session_schema" is not null) or ("plan_version_items"."offer_type" = 'combo' and "plan_version_items"."combo_id" is not null and "plan_version_items"."procedure_id" is null and "plan_version_items"."sessions" is null and "plan_version_items"."combo_name" is not null and "plan_version_items"."combo_snapshot" is not null));
