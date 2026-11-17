-- Migration 06: Shop Admin Approval (MultiShop Phase 1 Step 5)
-- Ensures 'pending_approval' value exists in enum_shops_status

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    JOIN pg_enum ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'enum_shops_status' AND pg_enum.enumlabel = 'pending_approval'
  ) THEN
    ALTER TYPE enum_shops_status ADD VALUE 'pending_approval';
  END IF;
END $$;
