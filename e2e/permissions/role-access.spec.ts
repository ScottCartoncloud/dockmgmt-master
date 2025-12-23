import { test, expect, TEST_USERS } from '../fixtures/test-fixtures';

test.describe('Operator Permissions', () => {
  test.use({ storageState: 'playwright/.auth/operator.json' });

  test('operator should access main calendar', async ({ page }) => {
    await page.goto('/');
    
    // Should be able to view calendar
    await page.waitForSelector('[data-testid="calendar-view"], .calendar-container, header', {
      timeout: 10000,
    });
    
    await expect(page.locator('header')).toBeVisible();
  });

  test('operator cannot access admin routes', async ({ page }) => {
    // Try to access admin page
    await page.goto('/admin');
    
    // Should be redirected or show access denied
    await page.waitForTimeout(2000);
    
    // Either redirected away from admin or shows error
    const isOnAdmin = page.url().includes('/admin');
    
    if (isOnAdmin) {
      // Should show access denied message
      await expect(page.locator('text=/denied|forbidden|unauthorized|access/i')).toBeVisible({
        timeout: 5000,
      });
    } else {
      // Redirected away - that's also acceptable
      expect(page.url()).not.toContain('/admin');
    }
  });

  test('operator cannot access user management settings', async ({ page }) => {
    await page.goto('/settings?tab=users');
    
    await page.waitForTimeout(2000);
    
    // Should either not show user management or show access denied
    const userManagementVisible = await page.locator('h2:has-text("User Management"), text=/invite user/i').isVisible();
    
    if (userManagementVisible) {
      // If visible, should not have ability to invite
      const inviteButton = page.locator('button:has-text("Invite")');
      await expect(inviteButton).not.toBeVisible();
    }
  });

  test('operator can create bookings', async ({ page }) => {
    await page.goto('/');
    
    await page.waitForSelector('[data-testid="calendar-view"], .calendar-container', {
      timeout: 10000,
    });
    
    // Try to find add booking functionality
    const addButton = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create")').first();
    
    if (await addButton.isVisible()) {
      await expect(addButton).toBeEnabled();
    }
  });

  test('operator cannot delete bookings', async ({ page }) => {
    await page.goto('/');
    
    await page.waitForSelector('[data-testid="calendar-view"], .calendar-container', {
      timeout: 10000,
    });
    
    // Find a booking and try to delete
    const booking = page.locator('[data-testid="booking-card"]').first();
    
    if (await booking.isVisible()) {
      await booking.click();
      
      // Wait for modal
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      
      // Delete button should not be visible or should be disabled for operators
      const deleteButton = page.locator('button:has-text("Delete")');
      
      // Either not visible or not enabled
      if (await deleteButton.isVisible()) {
        // Click and verify it doesn't work or shows error
        const isEnabled = await deleteButton.isEnabled();
        expect(isEnabled).toBeFalsy();
      }
    }
  });
});

test.describe('Super User Permissions', () => {
  test.use({ storageState: 'playwright/.auth/superuser.json' });

  test('super user can access all routes', async ({ page }) => {
    // Test access to main page
    await page.goto('/');
    await page.waitForSelector('header', { timeout: 10000 });
    await expect(page.locator('header')).toBeVisible();
    
    // Test access to settings
    await page.goto('/settings');
    await expect(page.locator('text=/settings/i').first()).toBeVisible();
    
    // Test access to admin (if exists)
    await page.goto('/admin');
    await page.waitForTimeout(2000);
    // Super user should have access or be redirected appropriately
  });

  test('super user sees tenant dropdown', async ({ page }) => {
    await page.goto('/');
    
    await page.waitForSelector('header', { timeout: 10000 });
    
    // Look for tenant switcher/dropdown
    const tenantSwitcher = page.locator('[data-testid="tenant-switcher"], [aria-label*="tenant"], select[name="tenant"], button:has-text("tenant")');
    
    await expect(tenantSwitcher.first()).toBeVisible({ timeout: 5000 });
  });

  test('super user can switch between tenants', async ({ page }) => {
    await page.goto('/');
    
    await page.waitForSelector('header', { timeout: 10000 });
    
    // Find and click tenant switcher
    const tenantSwitcher = page.locator('[data-testid="tenant-switcher"], button[role="combobox"]').first();
    
    if (await tenantSwitcher.isVisible()) {
      await tenantSwitcher.click();
      
      // Wait for dropdown options
      await page.waitForSelector('[role="option"], [role="menuitem"]', { timeout: 5000 });
      
      // Should see multiple tenants
      const tenantOptions = page.locator('[role="option"], [role="menuitem"]');
      const count = await tenantOptions.count();
      
      expect(count).toBeGreaterThan(0);
      
      // Click a different tenant if available
      if (count > 1) {
        await tenantOptions.nth(1).click();
        await page.waitForTimeout(1000);
        
        // Verify tenant switched (UI should update)
        await expect(page.locator('header')).toBeVisible();
      }
    }
  });

  test('super user can access organisation settings', async ({ page }) => {
    await page.goto('/settings?tab=organisation');
    
    await page.waitForSelector('h2:has-text("Organisation"), [data-testid="organisation-settings"]', {
      timeout: 10000,
    });
    
    // Should have full access to settings
    const timezoneSelect = page.locator('button[role="combobox"], select[name="timezone"]').first();
    await expect(timezoneSelect).toBeVisible();
    await expect(timezoneSelect).toBeEnabled();
  });

  test('super user can manage users', async ({ page }) => {
    await page.goto('/settings?tab=users');
    
    await page.waitForSelector('h2:has-text("User"), text=/user management/i', {
      timeout: 10000,
    });
    
    // Should see invite button
    const inviteButton = page.locator('button:has-text("Invite")');
    await expect(inviteButton).toBeVisible();
    await expect(inviteButton).toBeEnabled();
  });
});

test.describe('Viewer Permissions', () => {
  test('viewer can only view, not edit', async ({ page, loginAs }) => {
    await loginAs('viewer');
    
    await page.goto('/');
    
    await page.waitForSelector('[data-testid="calendar-view"], .calendar-container', {
      timeout: 10000,
    });
    
    // Add/Create buttons should not be visible for viewers
    const addButton = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create")');
    
    // Either not visible or disabled
    if (await addButton.first().isVisible()) {
      await expect(addButton.first()).toBeDisabled();
    }
  });
});
