import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';

async function getEdgeFunctionErrorMessage(err: unknown): Promise<string | null> {
  const anyErr = err as any;
  const response: Response | undefined = anyErr?.context;
  if (!response) return null;

  try {
    const json = await response.clone().json();
    if (json?.error && typeof json.error === 'string') return json.error;
    if (json?.message && typeof json.message === 'string') return json.message;
    return null;
  } catch {
    return null;
  }
}

// Allowed CartonCloud API endpoints
export const CARTONCLOUD_API_ENDPOINTS = [
  { value: 'https://api.cartoncloud.com', label: 'api.cartoncloud.com (Default)' },
  { value: 'https://api.na.cartoncloud.com', label: 'api.na.cartoncloud.com (North America)' },
] as const;

export const DEFAULT_API_BASE_URL = 'https://api.cartoncloud.com';

// NOTE: CartonCloud credentials (client_id, client_secret) are ENCRYPTED in the database
// and NEVER exposed to client. They are only decrypted server-side in edge functions.
export interface CartonCloudSettings {
  id: string;
  cartoncloud_tenant_id: string;
  cartoncloud_tenant_slug: string | null;
  cartoncloud_tenant_name: string | null;
  tenant_id: string | null;
  is_active: boolean;
  api_base_url: string;
  created_at: string;
  updated_at: string;
  has_credentials: boolean;
}

/**
 * Build a deep link into the CartonCloud web app for a Sale Order or Purchase Order.
 * Returns null if we don't have enough info (slug or numericId missing).
 *
 * Examples:
 *   https://app.cartoncloud.com/InterCentral/SaleOrders/view/787061
 *   https://app.na.cartoncloud.com/Acme/PurchaseOrders/view/123
 */
export function buildCartonCloudAppUrl(
  settings: Pick<CartonCloudSettings, 'cartoncloud_tenant_slug' | 'api_base_url'> | null | undefined,
  type: 'PurchaseOrders' | 'SaleOrders',
  numericId: string | null | undefined,
): string | null {
  if (!settings?.cartoncloud_tenant_slug || !numericId) return null;
  let appHost = 'app.cartoncloud.com';
  try {
    const apiHost = new URL(settings.api_base_url || DEFAULT_API_BASE_URL).hostname;
    if (apiHost === 'api.na.cartoncloud.com') appHost = 'app.na.cartoncloud.com';
    else if (apiHost.startsWith('api.')) appHost = 'app.' + apiHost.slice(4);
  } catch {
    // fall back to default
  }
  return `https://${appHost}/${settings.cartoncloud_tenant_slug}/${type}/view/${numericId}`;
}

export function useCartonCloudSettings() {
  const { activeTenant } = useTenantContext();
  
  return useQuery({
    queryKey: ['cartoncloud-settings', activeTenant?.id],
    queryFn: async () => {
      let query = supabase
        .from('cartoncloud_settings_safe')
        .select('id, cartoncloud_tenant_id, cartoncloud_tenant_slug, cartoncloud_tenant_name, tenant_id, is_active, api_base_url, created_at, updated_at, has_credentials');

      if (activeTenant?.id) {
        query = query.eq('tenant_id', activeTenant.id);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return data as CartonCloudSettings;
    },
    enabled: !!activeTenant?.id,
    refetchOnWindowFocus: false,
  });
}

export interface SaveCartonCloudSettingsParams {
  client_id: string;
  client_secret: string;
  cartoncloud_tenant_id: string;
  api_base_url?: string;
}

export function useSaveCartonCloudSettings() {
  const queryClient = useQueryClient();
  const { activeTenant } = useTenantContext();

  return useMutation({
    mutationFn: async (settings: SaveCartonCloudSettingsParams) => {
      if (!activeTenant?.id) {
        throw new Error('No active tenant selected');
      }

      // Use edge function to encrypt and save credentials securely
      const { data, error } = await supabase.functions.invoke('cartoncloud-credentials', {
        body: {
          action: 'save',
          appTenantId: activeTenant.id,
          client_id: settings.client_id,
          client_secret: settings.client_secret,
          cartoncloud_tenant_id: settings.cartoncloud_tenant_id,
          api_base_url: settings.api_base_url || DEFAULT_API_BASE_URL,
        },
      });

      if (error) {
        const detailed = await getEdgeFunctionErrorMessage(error);
        throw new Error(detailed ?? error.message);
      }
      if (data?.error) throw new Error(data.error);

      return data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cartoncloud-settings'] });
      if (activeTenant?.id) {
        queryClient.refetchQueries({ queryKey: ['cartoncloud-settings', activeTenant.id] });
      }
    },
  });
}

export function useDeleteCartonCloudSettings() {
  const queryClient = useQueryClient();
  const { activeTenant } = useTenantContext();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!activeTenant?.id) {
        throw new Error('No active tenant selected');
      }

      // Use edge function to delete credentials securely
      const { data, error } = await supabase.functions.invoke('cartoncloud-credentials', {
        body: {
          action: 'delete',
          appTenantId: activeTenant.id,
          settings_id: id,
        },
      });

      if (error) {
        const detailed = await getEdgeFunctionErrorMessage(error);
        throw new Error(detailed ?? error.message);
      }
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cartoncloud-settings'] });
    },
  });
}

export interface CartonCloudOrderItem {
  id: string;
  poNumber: string;
  quantity: number;
  productName: string;
  unitOfMeasure: string;
}

export interface CartonCloudOrder {
  id: string;
  reference: string;
  customer: string;
  status: string;
  arrivalDate: string | null;
  itemCount: number;
  warehouseName: string;
  urgent?: boolean;
  instructions?: string;
  numericId?: string | null;
  items?: CartonCloudOrderItem[];
}

export interface CartonCloudSOResult {
  id: string;
  reference: string;
  customer: string;
  status: string;
  deliveryDate: string | null;
  itemCount: number;
  warehouseName: string;
  numericId?: string | null;
}

export function useSearchCartonCloudOrders() {
  const { activeTenant } = useTenantContext();

  return useMutation({
    mutationFn: async (searchTerm: string): Promise<CartonCloudOrder[]> => {
      if (!activeTenant?.id) {
        throw new Error('No active tenant selected');
      }

      const { data, error } = await supabase.functions.invoke('cartoncloud', {
        body: { action: 'search-orders', searchTerm, appTenantId: activeTenant.id },
      });

      if (error) {
        const detailed = await getEdgeFunctionErrorMessage(error);
        throw new Error(detailed ?? error.message);
      }
      if (data?.error) throw new Error(data.error);

      return data?.orders || [];
    },
  });
}

export function useSearchCartonCloudSOs() {
  const { activeTenant } = useTenantContext();

  return useMutation({
    mutationFn: async (searchTerm: string): Promise<CartonCloudSOResult[]> => {
      if (!activeTenant?.id) {
        throw new Error('No active tenant selected');
      }

      const { data, error } = await supabase.functions.invoke('cartoncloud', {
        body: { action: 'search-outbound-orders', searchTerm, appTenantId: activeTenant.id },
      });

      if (error) {
        const detailed = await getEdgeFunctionErrorMessage(error);
        throw new Error(detailed ?? error.message);
      }
      if (data?.error) throw new Error(data.error);

      return data?.orders || [];
    },
  });
}

export interface TestConnectionParams {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  apiBaseUrl?: string;
}

export function useTestCartonCloudConnection() {
  return useMutation({
    mutationFn: async (credentials: TestConnectionParams) => {
      const { data, error } = await supabase.functions.invoke('cartoncloud', {
        body: {
          action: 'test-connection',
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          tenantId: credentials.tenantId,
          apiBaseUrl: credentials.apiBaseUrl || DEFAULT_API_BASE_URL,
        },
      });

      if (error) {
        const detailed = await getEdgeFunctionErrorMessage(error);
        throw new Error(detailed ?? error.message);
      }
      return data;
    },
  });
}

export function useTestSavedCartonCloudConnection() {
  const { activeTenant } = useTenantContext();

  return useMutation({
    mutationFn: async () => {
      if (!activeTenant?.id) {
        throw new Error('No active tenant selected');
      }

      const { data, error } = await supabase.functions.invoke('cartoncloud', {
        body: { action: 'test-saved-connection', appTenantId: activeTenant.id },
      });

      if (error) {
        const detailed = await getEdgeFunctionErrorMessage(error);
        throw new Error(detailed ?? error.message);
      }
      return data;
    },
  });
}
