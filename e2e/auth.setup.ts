import { test as setup, expect } from '@playwright/test';
import { TEST_USERS } from './fixtures/test-fixtures';

const authFile = 'playwright/.auth/admin.json';

/**
 * Setup: Authenticate as admin user and save session
 * This runs before all tests that depend on 'setup'
 */
setup('authenticate as admin', async ({ page }) => {
  // Navigate to auth page
  await page.goto('/auth');
  
  // Wait for the page to load
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  
  // Fill in admin credentials
  await page.fill('input[type="email"]', TEST_USERS.admin.email);
  await page.fill('input[type="password"]', TEST_USERS.admin.password);
  
  // Submit the form
  await page.click('button[type="submit"]');
  
  // Wait for successful login - should redirect to home
  await page.waitForURL('/', { timeout: 15000 });
  
  // Verify we're logged in by checking for user-specific elements
  await expect(page.locator('header')).toBeVisible();
  
  // Save the authenticated state
  await page.context().storageState({ path: authFile });
});

/**
 * Additional auth states can be set up here for different roles
 */
setup.describe('Role-specific auth setup', () => {
  setup('save operator auth state', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForSelector('input[type="email"]');
    
    await page.fill('input[type="email"]', TEST_USERS.operator.email);
    await page.fill('input[type="password"]', TEST_USERS.operator.password);
    await page.click('button[type="submit"]');
    
    await page.waitForURL('/', { timeout: 15000 });
    await page.context().storageState({ path: 'playwright/.auth/operator.json' });
  });

  setup('save super user auth state', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForSelector('input[type="email"]');
    
    await page.fill('input[type="email"]', TEST_USERS.superUser.email);
    await page.fill('input[type="password"]', TEST_USERS.superUser.password);
    await page.click('button[type="submit"]');
    
    await page.waitForURL('/', { timeout: 15000 });
    await page.context().storageState({ path: 'playwright/.auth/superuser.json' });
  });
});
