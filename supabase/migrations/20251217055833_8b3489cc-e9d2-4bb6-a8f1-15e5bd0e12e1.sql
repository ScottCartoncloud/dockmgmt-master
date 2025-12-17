-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Operators and admins can insert dock_doors" ON public.dock_doors;

-- Create new INSERT policy that also allows super_users
CREATE POLICY "Operators and admins can insert dock_doors" 
ON public.dock_doors 
FOR INSERT 
WITH CHECK (
  is_super_user(auth.uid()) 
  OR (
    (tenant_id = get_user_tenant_id(auth.uid())) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role))
  )
);

-- Also update UPDATE policy to allow super_users
DROP POLICY IF EXISTS "Operators and admins can update dock_doors" ON public.dock_doors;

CREATE POLICY "Operators and admins can update dock_doors" 
ON public.dock_doors 
FOR UPDATE 
USING (
  is_super_user(auth.uid()) 
  OR (
    (tenant_id = get_user_tenant_id(auth.uid())) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role))
  )
);

-- Update DELETE policy to allow super_users
DROP POLICY IF EXISTS "Admins can delete dock_doors" ON public.dock_doors;

CREATE POLICY "Admins can delete dock_doors" 
ON public.dock_doors 
FOR DELETE 
USING (
  is_super_user(auth.uid()) 
  OR (
    (tenant_id = get_user_tenant_id(auth.uid())) 
    AND has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Update SELECT policy to allow super_users to see all docks
DROP POLICY IF EXISTS "Users can view dock_doors in their tenant" ON public.dock_doors;

CREATE POLICY "Users can view dock_doors in their tenant" 
ON public.dock_doors 
FOR SELECT 
USING (
  is_super_user(auth.uid()) 
  OR (tenant_id = get_user_tenant_id(auth.uid()))
);