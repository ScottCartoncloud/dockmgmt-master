import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTenantContext } from '@/hooks/useTenantContext';

export type FieldType = 'text' | 'dropdown' | 'multiselect' | 'date';

export interface CustomBookingField {
  id: string;
  tenant_id: string | null;
  label: string;
  field_type: FieldType;
  is_required: boolean;
  options: string[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CustomBookingFieldInsert = Omit<CustomBookingField, 'id' | 'created_at' | 'updated_at'>;
export type CustomBookingFieldUpdate = Partial<CustomBookingFieldInsert> & { id: string };

export function useCustomBookingFields() {
  const { activeTenant } = useTenantContext();
  
  return useQuery({
    queryKey: ['custom-booking-fields', activeTenant?.id],
    queryFn: async () => {
      let query = supabase
        .from('custom_booking_fields')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (activeTenant?.id) {
        query = query.eq('tenant_id', activeTenant.id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Parse options from JSONB
      return (data || []).map(field => ({
        ...field,
        options: Array.isArray(field.options) ? field.options : [],
      })) as CustomBookingField[];
    },
    enabled: !!activeTenant?.id,
  });
}

export function useActiveCustomBookingFields() {
  const { activeTenant } = useTenantContext();
  
  return useQuery({
    queryKey: ['custom-booking-fields', 'active', activeTenant?.id],
    queryFn: async () => {
      let query = supabase
        .from('custom_booking_fields')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (activeTenant?.id) {
        query = query.eq('tenant_id', activeTenant.id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return (data || []).map(field => ({
        ...field,
        options: Array.isArray(field.options) ? field.options : [],
      })) as CustomBookingField[];
    },
    enabled: !!activeTenant?.id,
  });
}

export function useCreateCustomBookingField() {
  const queryClient = useQueryClient();
  const { activeTenant } = useTenantContext();
  
  return useMutation({
    mutationFn: async (field: Omit<CustomBookingFieldInsert, 'sort_order' | 'tenant_id'>) => {
      if (!activeTenant?.id) {
        throw new Error('No active tenant selected');
      }

      // Get max sort_order for this tenant
      const { data: existing } = await supabase
        .from('custom_booking_fields')
        .select('sort_order')
        .eq('tenant_id', activeTenant.id)
        .order('sort_order', { ascending: false })
        .limit(1);
      
      const nextOrder = existing?.[0]?.sort_order ? existing[0].sort_order + 1 : 1;
      
      const { data, error } = await supabase
        .from('custom_booking_fields')
        .insert({ 
          ...field, 
          sort_order: nextOrder,
          tenant_id: activeTenant.id,
          options: field.options || [],
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as CustomBookingField;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-booking-fields'] });
      toast({ title: 'Field created', description: 'Custom field has been added.' });
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

export function useUpdateCustomBookingField() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: CustomBookingFieldUpdate) => {
      const { data, error } = await supabase
        .from('custom_booking_fields')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as CustomBookingField;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-booking-fields'] });
      toast({ title: 'Field updated', description: 'Changes have been saved.' });
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

export function useDeleteCustomBookingField() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_booking_fields')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-booking-fields'] });
      toast({ title: 'Field deleted', description: 'Custom field has been removed.' });
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

export function useReorderCustomBookingFields() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Update each field's sort_order
      const updates = orderedIds.map((id, index) => 
        supabase
          .from('custom_booking_fields')
          .update({ sort_order: index + 1 })
          .eq('id', id)
      );
      
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-booking-fields'] });
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
