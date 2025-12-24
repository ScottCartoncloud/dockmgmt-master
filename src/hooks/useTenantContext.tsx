import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useQueryClient } from '@tanstack/react-query';

// Only log in development mode
const isDev = import.meta.env.DEV;

interface Tenant {
  id: string;
  name: string;
}

interface TenantContextType {
  tenants: Tenant[];
  activeTenant: Tenant | null;
  setActiveTenant: (tenant: Tenant | null) => void;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const ACTIVE_TENANT_KEY = 'crossdock_active_tenant';

// Dev mode bypass - disabled since RLS requires authenticated user
const DEV_BYPASS_AUTH = false;

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user, isSuperUser, profile } = useAuth();
  const queryClient = useQueryClient();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenantState] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch tenants based on user role
  useEffect(() => {
    async function fetchTenants() {
      // In dev mode, fetch all tenants even without a user
      if (!user && !DEV_BYPASS_AUTH) {
        setTenants([]);
        setActiveTenantState(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // In dev mode or as super user, fetch all tenants
        if (DEV_BYPASS_AUTH || isSuperUser) {
          const { data, error } = await supabase
            .from('tenants')
            .select('id, name')
            .order('name');
          
          if (error) {
            if (isDev) console.error('[TenantContext] Error fetching tenants:', error.message);
            throw error;
          }
          setTenants(data || []);
        } else if (profile?.tenant_id) {
          // Regular users can only see their own tenant
          const { data, error } = await supabase
            .from('tenants')
            .select('id, name')
            .eq('id', profile.tenant_id)
            .single();
          
          if (error) {
            if (isDev) console.error('[TenantContext] Error fetching tenant:', error.message);
            throw error;
          }
          setTenants(data ? [data] : []);
        } else {
          setTenants([]);
        }
      } catch (error) {
        // Only log actual errors, not expected states
        setTenants([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTenants();
  }, [user, isSuperUser, profile?.tenant_id]);

  // Restore active tenant from localStorage on mount
  useEffect(() => {
    if (tenants.length === 0) return;

    // In dev mode, always ensure a tenant is selected
    if (DEV_BYPASS_AUTH) {
      const stored = localStorage.getItem(ACTIVE_TENANT_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const found = tenants.find((t) => t.id === parsed.id);
          if (found) {
            setActiveTenantState(found);
            return;
          }
        } catch {
          // Invalid stored data
        }
      }
      // Auto-select first tenant in dev mode
      setActiveTenantState(tenants[0]);
      localStorage.setItem(ACTIVE_TENANT_KEY, JSON.stringify(tenants[0]));
      return;
    }

    const stored = localStorage.getItem(ACTIVE_TENANT_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const found = tenants.find((t) => t.id === parsed.id);
        if (found) {
          setActiveTenantState(found);
          return;
        }
      } catch {
        // Invalid stored data
      }
    }

    // If user is a super user and stored tenant is missing/invalid, pick a sensible default.
    // This prevents the app from getting stuck with `activeTenant = null` (which disables many queries).
    if (isSuperUser && tenants.length > 0) {
      const defaultTenant =
        tenants.find((t) => t.id === '00000000-0000-0000-0000-000000000001') ?? tenants[0];
      setActiveTenantState(defaultTenant);
      localStorage.setItem(ACTIVE_TENANT_KEY, JSON.stringify(defaultTenant));
      return;
    }

    // Default to user's tenant or single tenant
    if (!isSuperUser && profile?.tenant_id) {
      const userTenant = tenants.find((t) => t.id === profile.tenant_id);
      if (userTenant) {
        setActiveTenantState(userTenant);
        localStorage.setItem(ACTIVE_TENANT_KEY, JSON.stringify(userTenant));
      }
    } else if (tenants.length === 1) {
      setActiveTenantState(tenants[0]);
      localStorage.setItem(ACTIVE_TENANT_KEY, JSON.stringify(tenants[0]));
    }
  }, [tenants, isSuperUser, profile?.tenant_id]);

  const setActiveTenant = useCallback((tenant: Tenant | null) => {
    setActiveTenantState(tenant);
    if (tenant) {
      localStorage.setItem(ACTIVE_TENANT_KEY, JSON.stringify(tenant));
    } else {
      localStorage.removeItem(ACTIVE_TENANT_KEY);
    }
    // Clear all cached queries to ensure fresh data for new tenant
    queryClient.clear();
  }, [queryClient]);

  return (
    <TenantContext.Provider value={{ tenants, activeTenant, setActiveTenant, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantContext() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenantContext must be used within a TenantProvider');
  }
  return context;
}
