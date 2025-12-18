import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';

export interface CartonCloudSettings {
  id: string;
  client_id: string;
  client_secret: string;
  cartoncloud_tenant_id: string;
  tenant_id: string | null; // app multi-tenancy
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useCartonCloudSettings() {
  const { activeTenant } = useTenantContext();
  
  return useQuery({
    queryKey: ['cartoncloud-settings', activeTenant?.id],
    queryFn: async () => {
      let query = supabase
        .from('cartoncloud_settings')
        .select('*');
      
      if (activeTenant?.id) {
        query = query.eq('tenant_id', activeTenant.id);
      }
      
      const { data, error } = await query.maybeSingle();
      
      if (error) throw error;
      return data as CartonCloudSettings | null;
    },
    enabled: !!activeTenant?.id,
  });
}

export function useSaveCartonCloudSettings() {
  const queryClient = useQueryClient();
  const { activeTenant } = useTenantContext();

  return useMutation({
    mutationFn: async (settings: { client_id: string; client_secret: string; cartoncloud_tenant_id: string }) => {
      if (!activeTenant?.id) {
        throw new Error('No active tenant selected');
      }

      // First check if settings exist for this tenant
      const { data: existing } = await supabase
        .from('cartoncloud_settings')
        .select('id')
        .eq('tenant_id', activeTenant.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('cartoncloud_settings')
          .update({
            client_id: settings.client_id,
            client_secret: settings.client_secret,
            cartoncloud_tenant_id: settings.cartoncloud_tenant_id,
            is_active: true,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new with tenant_id
        const { data, error } = await supabase
          .from('cartoncloud_settings')
          .insert({
            client_id: settings.client_id,
            client_secret: settings.client_secret,
            cartoncloud_tenant_id: settings.cartoncloud_tenant_id,
            tenant_id: activeTenant.id,
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cartoncloud-settings'] });
    },
  });
}

export function useDeleteCartonCloudSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cartoncloud_settings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cartoncloud-settings'] });
    },
  });
}

export interface CartonCloudOrder {
  id: string;
  reference: string;
  customer: string;
  status: string;
  arrivalDate: string | null;
  itemCount: number;
  warehouseName: string;
}

export function useSearchCartonCloudOrders() {
  return useMutation({
    mutationFn: async (searchTerm: string): Promise<CartonCloudOrder[]> => {
      const { data, error } = await supabase.functions.invoke('cartoncloud', {
        body: { action: 'search-orders', searchTerm },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data.orders || [];
    },
  });
}

export function useTestCartonCloudConnection() {
  return useMutation({
    mutationFn: async (credentials: { clientId: string; clientSecret: string; tenantId: string }) => {
      const { data, error } = await supabase.functions.invoke('cartoncloud', {
        body: { 
          action: 'test-connection',
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          tenantId: credentials.tenantId,
        },
      });

      if (error) throw error;
      return data;
    },
  });
}
