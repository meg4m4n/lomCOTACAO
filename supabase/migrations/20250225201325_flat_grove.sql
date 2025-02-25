/*
  # Update budget schema with new fields

  1. Changes
    - Add new columns to budgets table:
      - lomartex_ref (text)
      - client_ref (text) 
      - collection (text)
      - size (text)
      - images (jsonb array)
      - project_start_date (timestamptz)
      - estimated_end_date (timestamptz)
      - proposals (jsonb array)
    
    - Update budget_items table:
      - Add line_cost column
      - Add moq_quantity column
      - Add lead_time_days column
      - Remove margin column
      - Remove total_price column

  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns to budgets table
ALTER TABLE budgets 
  ADD COLUMN IF NOT EXISTS lomartex_ref text,
  ADD COLUMN IF NOT EXISTS client_ref text,
  ADD COLUMN IF NOT EXISTS collection text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS images jsonb[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS project_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_end_date timestamptz,
  ADD COLUMN IF NOT EXISTS proposals jsonb[] DEFAULT '{}';

-- Update budget_items table
DO $$
BEGIN
  -- Add new columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'budget_items' AND column_name = 'line_cost'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN line_cost numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'budget_items' AND column_name = 'moq_quantity'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN moq_quantity integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'budget_items' AND column_name = 'lead_time_days'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN lead_time_days integer;
  END IF;

  -- Remove old columns safely
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'budget_items' AND column_name = 'margin'
  ) THEN
    ALTER TABLE budget_items DROP COLUMN margin;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'budget_items' AND column_name = 'total_price'
  ) THEN
    ALTER TABLE budget_items DROP COLUMN total_price;
  END IF;
END $$;