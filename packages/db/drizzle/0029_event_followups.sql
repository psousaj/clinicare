ALTER TABLE "followups" ADD COLUMN IF NOT EXISTS "event_id" uuid;--> statement-breakpoint
ALTER TABLE "followups" ADD COLUMN IF NOT EXISTS "event_date" date;--> statement-breakpoint
ALTER TABLE "followups" ADD CONSTRAINT "followups_tenant_event_fk" FOREIGN KEY ("tenant_id","event_id") REFERENCES "events"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "followups" DROP CONSTRAINT IF EXISTS "followups_offer_type_valid";--> statement-breakpoint
ALTER TABLE "followups" ADD CONSTRAINT "followups_offer_type_valid" CHECK ("offer_type" IN ('procedure', 'combo', 'plan', 'event'));--> statement-breakpoint
ALTER TABLE "followups" DROP CONSTRAINT IF EXISTS "followups_offer_target_valid";--> statement-breakpoint
ALTER TABLE "followups" ADD CONSTRAINT "followups_offer_target_valid" CHECK (("offer_type" = 'procedure' AND "combo_id" IS NULL AND "plan_id" IS NULL AND "plan_version_id" IS NULL AND "event_id" IS NULL) OR ("offer_type" = 'combo' AND "combo_id" = "offer_id" AND "plan_id" IS NULL AND "plan_version_id" IS NULL AND "event_id" IS NULL) OR ("offer_type" = 'plan' AND "plan_id" = "offer_id" AND "combo_id" IS NULL AND "plan_version_id" IS NOT NULL AND "event_id" IS NULL) OR ("offer_type" = 'event' AND "event_id" = "offer_id" AND "event_date" IS NOT NULL AND "combo_id" IS NULL AND "plan_id" IS NULL AND "plan_version_id" IS NULL));--> statement-breakpoint
ALTER TABLE "followup_items" ADD COLUMN IF NOT EXISTS "combo_id" uuid;--> statement-breakpoint
ALTER TABLE "followup_items" ADD COLUMN IF NOT EXISTS "combo_name" text;--> statement-breakpoint
ALTER TABLE "followup_items" ADD COLUMN IF NOT EXISTS "package_price_cents" integer;--> statement-breakpoint
ALTER TABLE "followup_items" ADD CONSTRAINT "followup_items_package_valid" CHECK (("combo_id" IS NULL AND "combo_name" IS NULL AND "package_price_cents" IS NULL) OR ("combo_id" IS NOT NULL AND "combo_name" IS NOT NULL AND "package_price_cents" >= 0));--> statement-breakpoint
ALTER TABLE "followup_snapshots" DROP CONSTRAINT IF EXISTS "followup_snapshots_kind_valid";--> statement-breakpoint
ALTER TABLE "followup_snapshots" ADD CONSTRAINT "followup_snapshots_kind_valid" CHECK ("kind" IN ('combo', 'plan', 'event'));
