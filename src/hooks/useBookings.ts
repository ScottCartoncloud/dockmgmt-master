import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { CrossDockBooking, PurchaseOrder, CartonCloudPO, CustomFieldValues } from '@/types/booking';
import { useEffect } from 'react';
import { Json } from '@/integrations/supabase/types';
import { format, parse } from 'date-fns';

// Helper to format date as YYYY-MM-DD in local timezone (not UTC)
const formatDateForDB = (date: Date | string): string => {
  if (typeof date === 'string') return date;
  return format(date, 'yyyy-MM-dd');
};

// Parse YYYY-MM-DD string as local date (not UTC) to avoid timezone shift
const parseDateFromDB = (dateStr: string): Date => {
  // parse() interprets the date in local timezone, avoiding the UTC midnight issue
  return parse(dateStr, 'yyyy-MM-dd', new Date());
};

// Convert database row to frontend booking type
const rowToBooking = (row: {
  id: string;
  tenant_id: string | null;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  carrier: string | null;
  carrier_id: string | null;
  truck_rego: string | null;
  pallets: number | null;
  dock_door_id: string | null;
  purchase_order_id: string | null;
  purchase_order: Json | null;
  cartoncloud_po: Json | null;
  notes: string | null;
  status: string;
  custom_fields: Json | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}, dockDoors?: { id: string; name: string }[], carriers?: { id: string; name: string }[]): CrossDockBooking => {
  // Extract dock number from dock door name or find by ID
  let dockNumber: number | undefined;
  if (row.dock_door_id && dockDoors) {
    const dock = dockDoors.find(d => d.id === row.dock_door_id);
    if (dock) {
      const match = dock.name.match(/\d+/);
      dockNumber = match ? parseInt(match[0], 10) : undefined;
    }
  }

  // Get carrier name: prefer carrier_id lookup, fallback to carrier text
  let carrierName = row.carrier || '';
  if (row.carrier_id && carriers) {
    const linkedCarrier = carriers.find(c => c.id === row.carrier_id);
    if (linkedCarrier) {
      carrierName = linkedCarrier.name;
    }
  }

  return {
    id: row.id,
    title: row.title,
    date: parseDateFromDB(row.date),
    startTime: row.start_time.slice(0, 5), // "HH:MM:SS" -> "HH:MM"
    endTime: row.end_time.slice(0, 5),
    carrier: carrierName,
    carrierId: row.carrier_id || undefined,
    truckRego: row.truck_rego || undefined,
    pallets: row.pallets ?? undefined,
    dockNumber,
    dockDoorId: row.dock_door_id || undefined,
    purchaseOrderId: row.purchase_order_id || undefined,
    purchaseOrder: row.purchase_order as unknown as PurchaseOrder | undefined,
    cartonCloudPO: row.cartoncloud_po as unknown as CartonCloudPO | undefined,
    notes: row.notes || undefined,
    status: row.status as CrossDockBooking['status'],
    createdBy: row.created_by || 'unknown',
    createdAt: new Date(row.created_at),
    customFields: row.custom_fields as unknown as CustomFieldValues | undefined,
  };
};

export const useBookings = () => {
  const { activeTenant } = useTenantContext();
  const queryClient = useQueryClient();

  const { data: bookings = [], isLoading, error } = useQuery({
    queryKey: ['bookings', activeTenant?.id],
    queryFn: async () => {
      if (!activeTenant?.id) return [];

      // Fetch dock doors and carriers for mapping
      const [{ data: dockDoors }, { data: carriers }] = await Promise.all([
        supabase
          .from('dock_doors')
          .select('id, name')
          .eq('tenant_id', activeTenant.id),
        supabase
          .from('carriers')
          .select('id, name')
          .eq('tenant_id', activeTenant.id),
      ]);

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      return (data || []).map((row) => rowToBooking(row, dockDoors || [], carriers || []));
    },
    enabled: !!activeTenant?.id,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!activeTenant?.id) return;

    const channel = supabase
      .channel('bookings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `tenant_id=eq.${activeTenant.id}`,
        },
        () => {
          // Refetch bookings on any change
          queryClient.invalidateQueries({ queryKey: ['bookings', activeTenant.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTenant?.id, queryClient]);

  return { bookings, isLoading, error };
};

export const useCreateBooking = () => {
  const { activeTenant } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (booking: Partial<CrossDockBooking> & { dockDoorId?: string; carrierId?: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          tenant_id: activeTenant?.id || null,
          title: booking.title || 'New Booking',
          date: formatDateForDB(booking.date || new Date()),
          start_time: booking.startTime || '09:00',
          end_time: booking.endTime || '10:00',
          carrier: booking.carrier || null,
          carrier_id: booking.carrierId || null,
          truck_rego: booking.truckRego || null,
          pallets: booking.pallets ?? null,
          dock_door_id: booking.dockDoorId || null,
          purchase_order_id: booking.purchaseOrderId || null,
          purchase_order: booking.purchaseOrder as unknown as Json || null,
          cartoncloud_po: booking.cartonCloudPO as unknown as Json || null,
          notes: booking.notes || null,
          status: booking.status || 'scheduled',
          custom_fields: booking.customFields as unknown as Json || {},
          created_by: userData.user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', activeTenant?.id] });
    },
  });
};

export const useUpdateBooking = () => {
  const { activeTenant } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...booking }: Partial<CrossDockBooking> & { id: string; dockDoorId?: string; carrierId?: string }) => {
      const updateData: Record<string, unknown> = {};
      
      if (booking.title !== undefined) updateData.title = booking.title;
      if (booking.date !== undefined) {
        updateData.date = formatDateForDB(booking.date);
      }
      if (booking.startTime !== undefined) updateData.start_time = booking.startTime;
      if (booking.endTime !== undefined) updateData.end_time = booking.endTime;
      if (booking.carrier !== undefined) updateData.carrier = booking.carrier || null;
      if (booking.carrierId !== undefined) updateData.carrier_id = booking.carrierId || null;
      if (booking.truckRego !== undefined) updateData.truck_rego = booking.truckRego || null;
      if (booking.pallets !== undefined) updateData.pallets = booking.pallets ?? null;
      if (booking.dockDoorId !== undefined) updateData.dock_door_id = booking.dockDoorId || null;
      if (booking.purchaseOrderId !== undefined) updateData.purchase_order_id = booking.purchaseOrderId || null;
      if (booking.purchaseOrder !== undefined) updateData.purchase_order = booking.purchaseOrder || null;
      if (booking.cartonCloudPO !== undefined) updateData.cartoncloud_po = booking.cartonCloudPO || null;
      if (booking.notes !== undefined) updateData.notes = booking.notes || null;
      if (booking.status !== undefined) updateData.status = booking.status;
      if (booking.customFields !== undefined) updateData.custom_fields = booking.customFields || {};

      const { data, error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', activeTenant?.id] });
    },
  });
};

export const useDeleteBooking = () => {
  const { activeTenant } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', activeTenant?.id] });
    },
  });
};
