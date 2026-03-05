CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  invite_record RECORD;
BEGIN
  RAISE LOG 'handle_new_user triggered for email: %', NEW.email;
  
  SELECT * INTO invite_record 
  FROM public.tenant_invites 
  WHERE lower(email) = lower(NEW.email)
    AND accepted_at IS NULL 
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF invite_record IS NOT NULL THEN
    RAISE LOG 'handle_new_user: Found invite % for tenant % with role %', 
              invite_record.id, invite_record.tenant_id, invite_record.role;
    
    INSERT INTO public.profiles (id, tenant_id, email, full_name)
    VALUES (NEW.id, invite_record.tenant_id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, invite_record.role);
    
    INSERT INTO public.user_tenants (user_id, tenant_id)
    VALUES (NEW.id, invite_record.tenant_id);
    
    UPDATE public.tenant_invites 
    SET accepted_at = now() 
    WHERE id = invite_record.id;
    
    RAISE LOG 'handle_new_user: Successfully processed invite for %', NEW.email;
  ELSE
    RAISE LOG 'handle_new_user: No valid invite found for %, creating profile without tenant', NEW.email;
    
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user ERROR for %: % %', NEW.email, SQLERRM, SQLSTATE;
    BEGIN
      INSERT INTO public.profiles (id, email, full_name)
      VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE LOG 'handle_new_user: Failed to create fallback profile: %', SQLERRM;
    END;
    RETURN NEW;
END;
$function$