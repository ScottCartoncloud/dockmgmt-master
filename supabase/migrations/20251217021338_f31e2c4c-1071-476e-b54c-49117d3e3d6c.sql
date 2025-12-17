-- Add super_user to app_role enum (must be done in separate transaction before use)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_user';