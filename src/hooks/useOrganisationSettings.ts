import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { toast } from 'sonner';

export interface WorkingHours {
  id?: string;
  tenant_id: string;
  day_of_week: number; // 0=Sunday, 6=Saturday
  enabled: boolean;
  start_time: string;
  end_time: string;
}

export interface TenantSettings {
  timezone: string;
  workingHours: WorkingHours[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const getDayName = (dayOfWeek: number): string => DAY_NAMES[dayOfWeek];

// Common IANA timezones for the dropdown
export const COMMON_TIMEZONES = [
  'Pacific/Auckland',
  'Pacific/Fiji',
  'Australia/Sydney',
  'Australia/Brisbane',
  'Australia/Adelaide',
  'Australia/Darwin',
  'Australia/Perth',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Europe/Athens',
  'Europe/Helsinki',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/London',
  'Atlantic/Reykjavik',
  'America/Sao_Paulo',
  'America/Buenos_Aires',
  'America/New_York',
  'America/Toronto',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Vancouver',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
];

export const useOrganisationSettings = () => {
  const { activeTenant } = useTenantContext();
  const queryClient = useQueryClient();

  // Fetch tenant timezone
  const { data: tenantData, isLoading: isLoadingTenant } = useQuery({
    queryKey: ['tenant-settings', activeTenant?.id],
    queryFn: async () => {
      if (!activeTenant?.id) return null;
      
      const { data, error } = await supabase
        .from('tenants')
        .select('timezone')
        .eq('id', activeTenant.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!activeTenant?.id,
  });

  // Fetch working hours
  const { data: workingHours, isLoading: isLoadingHours } = useQuery({
    queryKey: ['tenant-working-hours', activeTenant?.id],
    queryFn: async () => {
      if (!activeTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('tenant_working_hours')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .order('day_of_week');
      
      if (error) throw error;
      return data as WorkingHours[];
    },
    enabled: !!activeTenant?.id,
  });

  // Update timezone
  const updateTimezoneMutation = useMutation({
    mutationFn: async (timezone: string) => {
      if (!activeTenant?.id) throw new Error('No active tenant');
      
      const { error } = await supabase
        .from('tenants')
        .update({ timezone })
        .eq('id', activeTenant.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings', activeTenant?.id] });
      toast.success('Timezone updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update timezone: ${error.message}`);
    },
  });

  // Upsert working hours (insert or update)
  const upsertWorkingHoursMutation = useMutation({
    mutationFn: async (hours: WorkingHours[]) => {
      if (!activeTenant?.id) throw new Error('No active tenant');
      
      // Use upsert with the unique constraint on (tenant_id, day_of_week)
      const { error } = await supabase
        .from('tenant_working_hours')
        .upsert(
          hours.map(h => ({
            tenant_id: activeTenant.id,
            day_of_week: h.day_of_week,
            enabled: h.enabled,
            start_time: h.start_time,
            end_time: h.end_time,
          })),
          { onConflict: 'tenant_id,day_of_week' }
        );
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-working-hours', activeTenant?.id] });
      toast.success('Working hours updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update working hours: ${error.message}`);
    },
  });

  // Initialize default working hours if none exist
  const initializeWorkingHours = async () => {
    if (!activeTenant?.id) return;
    
    const defaultHours: Omit<WorkingHours, 'id'>[] = [
      { tenant_id: activeTenant.id, day_of_week: 0, enabled: false, start_time: '08:00', end_time: '17:00' },
      { tenant_id: activeTenant.id, day_of_week: 1, enabled: true, start_time: '08:00', end_time: '17:00' },
      { tenant_id: activeTenant.id, day_of_week: 2, enabled: true, start_time: '08:00', end_time: '17:00' },
      { tenant_id: activeTenant.id, day_of_week: 3, enabled: true, start_time: '08:00', end_time: '17:00' },
      { tenant_id: activeTenant.id, day_of_week: 4, enabled: true, start_time: '08:00', end_time: '17:00' },
      { tenant_id: activeTenant.id, day_of_week: 5, enabled: true, start_time: '08:00', end_time: '17:00' },
      { tenant_id: activeTenant.id, day_of_week: 6, enabled: false, start_time: '08:00', end_time: '17:00' },
    ];
    
    await upsertWorkingHoursMutation.mutateAsync(defaultHours as WorkingHours[]);
  };

  return {
    timezone: tenantData?.timezone || 'UTC',
    workingHours: workingHours || [],
    isLoading: isLoadingTenant || isLoadingHours,
    updateTimezone: updateTimezoneMutation.mutate,
    updateWorkingHours: upsertWorkingHoursMutation.mutate,
    initializeWorkingHours,
    isUpdating: updateTimezoneMutation.isPending || upsertWorkingHoursMutation.isPending,
  };
};
