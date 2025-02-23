/*
  # Initial Schema Setup for Budget Management System

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key) - References auth.users
      - `email` (text)
      - `full_name` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `clients`
      - `id` (uuid, primary key)
      - `name` (text)
      - `brand` (text)
      - `email` (text)
      - `references` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `user_id` (uuid) - References profiles
    
    - `budgets`
      - `id` (uuid, primary key)
      - `client_id` (uuid) - References clients
      - `title` (text)
      - `status` (text)
      - `total_amount` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `user_id` (uuid) - References profiles
    
    - `budget_items`
      - `id` (uuid, primary key)
      - `budget_id` (uuid) - References budgets
      - `description` (text)
      - `quantity` (numeric)
      - `unit_price` (numeric)
      - `margin` (numeric)
      - `total_price` (numeric)
      - `type` (text) - 'material' or 'extra'
      - `image_url` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users,
  email text UNIQUE NOT NULL,
  full_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create clients table
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  email text,
  references text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES profiles(id) NOT NULL
);

-- Create budgets table
CREATE TABLE budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) NOT NULL,
  title text NOT NULL,
  status text DEFAULT 'draft',
  total_amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES profiles(id) NOT NULL
);

-- Create budget_items table
CREATE TABLE budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid REFERENCES budgets(id) NOT NULL,
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  unit_price numeric DEFAULT 0,
  margin numeric DEFAULT 0,
  total_price numeric DEFAULT 0,
  type text CHECK (type IN ('material', 'extra')) NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own profile"
  ON profiles
  USING (auth.uid() = id);

CREATE POLICY "Users can manage their own clients"
  ON clients
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own budgets"
  ON budgets
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own budget items"
  ON budget_items
  USING (budget_id IN (
    SELECT id FROM budgets WHERE user_id = auth.uid()
  ));

-- Create functions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_budget_items_updated_at
  BEFORE UPDATE ON budget_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();