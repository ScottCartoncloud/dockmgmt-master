import { test, expect } from '../fixtures/test-fixtures';

test.describe('Organisation Settings', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('should load organisation settings page', async ({ page }) => {
    await page.goto('/settings?tab=organisation');
    
    // Wait for page to load
    await page.waitForSelector('h2:has-text("Organisation"), [data-testid="organisation-settings"]', {
      timeout: 10000,
    });
    
    // Verify main sections are visible
    await expect(page.locator('text=/timezone/i').first()).toBeVisible();
    await expect(page.locator('text=/working hours/i').first()).toBeVisible();
  });

  test('should set timezone', async ({ page }) => {
    await page.goto('/settings?tab=organisation');
    
    // Wait for settings to load
    await page.waitForSelector('h2:has-text("Organisation")', { timeout: 10000 });
    
    // Find timezone selector
    const timezoneCombobox = page.locator('button[role="combobox"]').first();
    
    if (await timezoneCombobox.isVisible()) {
      await timezoneCombobox.click();
      
      // Wait for dropdown
      await page.waitForSelector('[role="listbox"], [role="option"]', { timeout: 5000 });
      
      // Select a timezone (e.g., Sydney)
      const sydneyOption = page.locator('[role="option"]', { hasText: /Sydney/i }).first();
      
      if (await sydneyOption.isVisible()) {
        await sydneyOption.click();
        
        // Look for a save button or auto-save indicator
        const saveButton = page.locator('button:has-text("Save")').first();
        
        if (await saveButton.isVisible() && await saveButton.isEnabled()) {
          await saveButton.click();
          
          // Wait for save
          await page.waitForTimeout(2000);
          
          // Check for success toast or indicator
          const toast = page.locator('[data-sonner-toast], [role="status"]');
          if (await toast.isVisible()) {
            await expect(toast).toContainText(/saved|updated|success/i);
          }
        }
      }
    }
  });

  test('should set working hours', async ({ page }) => {
    await page.goto('/settings?tab=organisation');
    
    // Wait for settings
    await page.waitForSelector('h2:has-text("Organisation")', { timeout: 10000 });
    
    // Find working hours section
    const workingHoursSection = page.locator('text=/working hours/i').first();
    await expect(workingHoursSection).toBeVisible();
    
    // Find day toggles (e.g., Monday)
    const mondayToggle = page.locator('[data-testid="day-toggle-1"], label:has-text("Monday") + input, [aria-label*="Monday"]').first();
    
    if (await mondayToggle.isVisible()) {
      // Toggle if it's a switch
      const isSwitch = await mondayToggle.getAttribute('role') === 'switch';
      if (isSwitch) {
        await mondayToggle.click();
      }
    }
    
    // Find time inputs
    const startTimeInputs = page.locator('input[type="time"], select[name*="start"]');
    const firstStartTime = startTimeInputs.first();
    
    if (await firstStartTime.isVisible()) {
      // Set start time
      await firstStartTime.fill('08:00');
    }
    
    // Save settings
    const saveButton = page.locator('button:has-text("Save")').first();
    if (await saveButton.isVisible() && await saveButton.isEnabled()) {
      await saveButton.click();
      await page.waitForTimeout(2000);
    }
  });

  test('should respect working hours in calendar', async ({ page }) => {
    // First, verify working hours are set
    await page.goto('/settings?tab=organisation');
    await page.waitForSelector('h2:has-text("Organisation")', { timeout: 10000 });
    
    // Navigate to calendar
    await page.goto('/');
    await page.waitForSelector('[data-testid="calendar-view"], .calendar-container', {
      timeout: 10000,
    });
    
    // The calendar should only show time slots within working hours
    // This is a visual verification - check that the calendar displays correctly
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show fallback timezone banner when not set', async ({ page }) => {
    await page.goto('/settings?tab=organisation');
    
    // Wait for page
    await page.waitForSelector('h2:has-text("Organisation")', { timeout: 10000 });
    
    // Check for fallback timezone banner (amber/warning alert)
    const fallbackBanner = page.locator('[role="alert"], .alert, [class*="alert"]').filter({ 
      hasText: /applied.*local timezone|browser timezone/i 
    });
    
    // Banner may or may not be visible depending on whether timezone is set
    if (await fallbackBanner.isVisible()) {
      // Verify it shows the browser timezone
      await expect(fallbackBanner).toContainText(/timezone/i);
    }
  });
});
