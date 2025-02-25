/*
  # Fix client references and add missing policies

  1. Changes
    - Remove reference_notes column from clients table
    - Add missing RLS policies
*/

-- Remove reference_notes column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'reference_notes'
  ) THEN
    ALTER TABLE clients DROP COLUMN reference_notes;
  END IF;
END $$;

-- Add missing policies if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own profile'
  ) THEN
    CREATE POLICY "Users can manage their own profile"
      ON profiles
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own clients'
  ) THEN
    CREATE POLICY "Users can manage their own clients"
      ON clients
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own budgets'
  ) THEN
    CREATE POLICY "Users can manage their own budgets"
      ON budgets
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own budget items'
  ) THEN
    CREATE POLICY "Users can manage their own budget items"
      ON budget_items
      USING (budget_id IN (
        SELECT id FROM budgets WHERE user_id = auth.uid()
      ));
  END IF;
END $$;