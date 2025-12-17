import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user, isSuperUser, profile } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenantState] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch tenants based on user role
  useEffect(() => {
    async function fetchTenants() {
      if (!user) {
        setTenants([]);
        setActiveTenantState(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        if (isSuperUser) {
          // Super users can see all tenants
          const { data, error } = await supabase
            .from('tenants')
            .select('id, name')
            .order('name');
          
          if (error) throw error;
          setTenants(data || []);
        } else if (profile?.tenant_id) {
          // Regular users can only see their own tenant
          const { data, error } = await supabase
            .from('tenants')
            .select('id, name')
            .eq('id', profile.tenant_id)
            .single();
          
          if (error) throw error;
          setTenants(data ? [data] : []);
        } else {
          setTenants([]);
        }
      } catch (error) {
        console.error('Error fetching tenants:', error);
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

    const stored = localStorage.getItem(ACTIVE_TENANT_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Verify the stored tenant is in the available list
        const found = tenants.find(t => t.id === parsed.id);
        if (found) {
          setActiveTenantState(found);
          return;
        }
      } catch {
        // Invalid stored data
      }
    }

    // Default to first available tenant or user's tenant
    if (!isSuperUser && profile?.tenant_id) {
      const userTenant = tenants.find(t => t.id === profile.tenant_id);
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
  }, []);

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
