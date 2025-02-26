/*
  # Add budget extras and pricing options

  1. Changes to budget_items
    - Add lead_time_days column

  2. New Tables
    - budget_extras
      - id (uuid, primary key)
      - budget_id (uuid, foreign key)
      - description (text)
      - supplier (text)
      - unit_price (numeric)
      - quantity (numeric)
      - lead_time_days (integer)
      - line_cost (numeric)
      - created_at (timestamptz)
      - updated_at (timestamptz)

    - budget_pricing_options
      - id (uuid, primary key)
      - budget_id (uuid, foreign key)
      - base_cost (numeric)
      - quantity (numeric)
      - margin_percentage (numeric)
      - margin_amount (numeric)
      - total_cost (numeric)
      - client_price (numeric)
      - created_at (timestamptz)
      - updated_at (timestamptz)

  3. Security
    - Enable RLS on new tables
    - Add policies for authenticated users
*/

-- Add lead_time_days to budget_items if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'lead_time_days'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN lead_time_days integer;
  END IF;
END $$;

-- Create budget_extras table
CREATE TABLE IF NOT EXISTS budget_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid REFERENCES budgets(id) NOT NULL,
  description text NOT NULL,
  supplier text NOT NULL,
  unit_price numeric DEFAULT 0,
  quantity numeric DEFAULT 1,
  lead_time_days integer,
  line_cost numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create budget_pricing_options table
CREATE TABLE IF NOT EXISTS budget_pricing_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid REFERENCES budgets(id) NOT NULL,
  base_cost numeric DEFAULT 0,
  quantity numeric DEFAULT 1,
  margin_percentage numeric DEFAULT 0,
  margin_amount numeric DEFAULT 0,
  total_cost numeric DEFAULT 0,
  client_price numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE budget_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_pricing_options ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own budget extras"
  ON budget_extras
  USING (budget_id IN (
    SELECT id FROM budgets WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage their own budget pricing options"
  ON budget_pricing_options
  USING (budget_id IN (
    SELECT id FROM budgets WHERE user_id = auth.uid()
  ));

-- Create triggers for updated_at
CREATE TRIGGER update_budget_extras_updated_at
  BEFORE UPDATE ON budget_extras
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_budget_pricing_options_updated_at
  BEFORE UPDATE ON budget_pricing_options
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();