-- Drop the problematic policy that blocks SELECT too
DROP POLICY IF EXISTS "Service role only for mutations" ON public.cartoncloud_settings;

-- Create separate policies for each mutation operation
CREATE POLICY "Service role only for insert"
ON public.cartoncloud_settings
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Service role only for update"
ON public.cartoncloud_settings
FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Service role only for delete"
ON public.cartoncloud_settings
FOR DELETE
USING (false);