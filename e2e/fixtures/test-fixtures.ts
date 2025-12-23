import { test as base, expect, Page } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Test user credentials - use env vars or defaults for test environment
export const TEST_USERS = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'test-admin@example.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'TestPassword123!',
  },
  operator: {
    email: process.env.TEST_OPERATOR_EMAIL || 'test-operator@example.com',
    password: process.env.TEST_OPERATOR_PASSWORD || 'TestPassword123!',
  },
  viewer: {
    email: process.env.TEST_VIEWER_EMAIL || 'test-viewer@example.com',
    password: process.env.TEST_VIEWER_PASSWORD || 'TestPassword123!',
  },
  superUser: {
    email: process.env.TEST_SUPER_USER_EMAIL || 'test-super@example.com',
    password: process.env.TEST_SUPER_USER_PASSWORD || 'TestPassword123!',
  },
};

// Test tenant and carrier info
export const TEST_DATA = {
  tenantName: process.env.TEST_TENANT_NAME || 'Test Tenant',
  carrierBookingLinkId: process.env.TEST_CARRIER_BOOKING_LINK_ID || '',
};

// Supabase client for test utilities
function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.PLAYWRIGHT_SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.PLAYWRIGHT_SUPABASE_KEY || '';
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and key are required for E2E tests');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Extended test fixture with common utilities
type TestFixtures = {
  supabase: SupabaseClient;
  loginAs: (role: 'admin' | 'operator' | 'viewer' | 'superUser') => Promise<void>;
  waitForToast: (message: string) => Promise<void>;
  setTimezone: (timezone: string) => Promise<void>;
};

export const test = base.extend<TestFixtures>({
  supabase: async ({}, use) => {
    const client = getSupabaseClient();
    await use(client);
  },

  loginAs: async ({ page }, use) => {
    const login = async (role: 'admin' | 'operator' | 'viewer' | 'superUser') => {
      const user = TEST_USERS[role];
      await page.goto('/auth');
      
      // Wait for the auth page to load
      await page.waitForSelector('input[type="email"]');
      
      // Fill in credentials
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', user.password);
      
      // Click login button
      await page.click('button[type="submit"]');
      
      // Wait for redirect to main page
      await page.waitForURL('/', { timeout: 15000 });
    };
    
    await use(login);
  },

  waitForToast: async ({ page }, use) => {
    const waitForToast = async (message: string) => {
      await expect(page.locator('[data-sonner-toast]').filter({ hasText: message })).toBeVisible({
        timeout: 10000,
      });
    };
    
    await use(waitForToast);
  },

  setTimezone: async ({ page }, use) => {
    const setTimezone = async (timezone: string) => {
      // Emulate timezone
      await page.context().addInitScript(`{
        const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
        Intl.DateTimeFormat.prototype.resolvedOptions = function() {
          const result = originalResolvedOptions.call(this);
          result.timeZone = '${timezone}';
          return result;
        };
      }`);
    };
    
    await use(setTimezone);
  },
});

export { expect };

// Helper to generate unique test data
export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

// Helper to format date for booking tests
export function getNextWeekday(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  
  // Skip to Monday if it's a weekend
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  
  return date;
}

// Helper to format time for inputs
export function formatTimeForInput(hours: number, minutes: number = 0): string {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
