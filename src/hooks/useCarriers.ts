import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { toast } from '@/hooks/use-toast';

export interface Carrier {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  booking_link_id: string;
  is_booking_link_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function useCarriers() {
  const queryClient = useQueryClient();
  const { activeTenant } = useTenantContext();

  const { data: carriers = [], isLoading, error } = useQuery({
    queryKey: ['carriers', activeTenant?.id],
    queryFn: async () => {
      if (!activeTenant?.id) return [];

      const { data, error } = await supabase
        .from('carriers')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Carrier[];
    },
    enabled: !!activeTenant?.id,
  });

  const createCarrier = useMutation({
    mutationFn: async (carrier: { name: string; email?: string }) => {
      if (!activeTenant?.id) throw new Error('No tenant selected');

      const { data, error } = await supabase
        .from('carriers')
        .insert({
          tenant_id: activeTenant.id,
          name: carrier.name,
          email: carrier.email || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carriers'] });
      toast({
        title: 'Carrier Created',
        description: 'The carrier has been added successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create carrier',
        variant: 'destructive',
      });
    },
  });

  const updateCarrier = useMutation({
    mutationFn: async (carrier: { id: string; name: string; email?: string }) => {
      const { data, error } = await supabase
        .from('carriers')
        .update({
          name: carrier.name,
          email: carrier.email || null,
        })
        .eq('id', carrier.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carriers'] });
      toast({
        title: 'Carrier Updated',
        description: 'The carrier has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update carrier',
        variant: 'destructive',
      });
    },
  });

  const deleteCarrier = useMutation({
    mutationFn: async (carrierId: string) => {
      const { error } = await supabase
        .from('carriers')
        .delete()
        .eq('id', carrierId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carriers'] });
      toast({
        title: 'Carrier Deleted',
        description: 'The carrier has been removed.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete carrier',
        variant: 'destructive',
      });
    },
  });

  const toggleBookingLink = useMutation({
    mutationFn: async ({ carrierId, enabled }: { carrierId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('carriers')
        .update({ is_booking_link_enabled: enabled })
        .eq('id', carrierId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['carriers'] });
      toast({
        title: variables.enabled ? 'Link Enabled' : 'Link Disabled',
        description: `Booking link has been ${variables.enabled ? 'enabled' : 'disabled'}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to toggle booking link',
        variant: 'destructive',
      });
    },
  });

  const resetBookingLink = useMutation({
    mutationFn: async (carrierId: string) => {
      const newLinkId = crypto.randomUUID();
      const { error } = await supabase
        .from('carriers')
        .update({ booking_link_id: newLinkId })
        .eq('id', carrierId);

      if (error) throw error;
      return newLinkId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carriers'] });
      toast({
        title: 'Link Reset',
        description: 'A new booking link has been generated. The old link will no longer work.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset booking link',
        variant: 'destructive',
      });
    },
  });

  return {
    carriers,
    isLoading,
    error,
    createCarrier,
    updateCarrier,
    deleteCarrier,
    toggleBookingLink,
    resetBookingLink,
  };
}
