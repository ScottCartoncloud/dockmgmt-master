import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTenantContext } from '@/hooks/useTenantContext';

export interface Warehouse {
  id: string;
  tenant_id: string;
  name: string;
  cartoncloud_warehouse_id: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useWarehouses() {
  const { activeTenant } = useTenantContext();

  const query = useQuery({
    queryKey: ['warehouses', activeTenant?.id],
    queryFn: async () => {
      if (!activeTenant?.id) return [];
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });
      if (error) throw error;
      return data as Warehouse[];
    },
    enabled: !!activeTenant?.id,
  });

  const defaultWarehouse = query.data?.find(w => w.is_default) ?? null;

  return {
    warehouses: query.data ?? [],
    defaultWarehouse,
    isLoading: query.isLoading,
  };
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient();
  const { activeTenant } = useTenantContext();

  return useMutation({
    mutationFn: async (data: { name: string; cartoncloud_warehouse_id: string }) => {
      if (!activeTenant) throw new Error('No active tenant');
      const { data: result, error } = await supabase
        .from('warehouses')
        .insert({ ...data, tenant_id: activeTenant.id })
        .select()
        .single();
      if (error) throw error;
      return result as Warehouse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast({ title: 'Warehouse created', description: 'New warehouse has been added.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; cartoncloud_warehouse_id?: string }) => {
      const { data, error } = await supabase
        .from('warehouses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Warehouse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast({ title: 'Warehouse updated', description: 'Changes have been saved.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Check if any docks are assigned
      const { data: docks } = await supabase
        .from('dock_doors')
        .select('id')
        .eq('warehouse_id', id)
        .limit(1);
      if (docks && docks.length > 0) {
        throw new Error('Cannot delete warehouse with assigned docks. Reassign or remove docks first.');
      }
      const { error } = await supabase.from('warehouses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast({ title: 'Warehouse deleted', description: 'Warehouse has been removed.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export function useSetDefaultWarehouse() {
  const queryClient = useQueryClient();
  const { activeTenant } = useTenantContext();

  return useMutation({
    mutationFn: async (warehouseId: string) => {
      if (!activeTenant) throw new Error('No active tenant');
      const { error } = await supabase.rpc('set_default_warehouse', {
        _warehouse_id: warehouseId,
        _tenant_id: activeTenant.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast({ title: 'Default warehouse updated' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}
