import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTenantContext } from '@/hooks/useTenantContext';

export interface DockDoor {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  sort_order: number;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export type DockDoorInsert = Omit<DockDoor, 'id' | 'created_at' | 'updated_at'>;
export type DockDoorUpdate = Partial<DockDoorInsert> & { id: string };

export function useDockDoors() {
  return useQuery({
    queryKey: ['dock-doors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dock_doors')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as DockDoor[];
    },
  });
}

export function useCreateDockDoor() {
  const queryClient = useQueryClient();
  const { activeTenant } = useTenantContext();
  
  return useMutation({
    mutationFn: async (dock: Omit<DockDoorInsert, 'sort_order' | 'tenant_id'>) => {
      if (!activeTenant) {
        throw new Error('No active tenant selected');
      }

      // Get max sort_order for this tenant
      const { data: existing } = await supabase
        .from('dock_doors')
        .select('sort_order')
        .eq('tenant_id', activeTenant.id)
        .order('sort_order', { ascending: false })
        .limit(1);
      
      const nextOrder = existing?.[0]?.sort_order ? existing[0].sort_order + 1 : 1;
      
      const { data, error } = await supabase
        .from('dock_doors')
        .insert({ ...dock, sort_order: nextOrder, tenant_id: activeTenant.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as DockDoor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dock-doors'] });
      toast({ title: 'Dock created', description: 'New dock door has been added.' });
    },
    onError: (error) => {
      toast({ 
        title: 'Error', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

export function useUpdateDockDoor() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: DockDoorUpdate) => {
      const { data, error } = await supabase
        .from('dock_doors')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as DockDoor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dock-doors'] });
      toast({ title: 'Dock updated', description: 'Changes have been saved.' });
    },
    onError: (error) => {
      toast({ 
        title: 'Error', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

export function useDeleteDockDoor() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dock_doors')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dock-doors'] });
      toast({ title: 'Dock deleted', description: 'Dock door has been removed.' });
    },
    onError: (error) => {
      toast({ 
        title: 'Error', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}
