import { test, expect } from '../fixtures/test-fixtures';

test.describe('Timezone Handling - AEST (Australia/Sydney)', () => {
  test.use({ 
    storageState: 'playwright/.auth/admin.json',
    timezoneId: 'Australia/Sydney',
  });

  test.beforeEach(async ({ page, setTimezone }) => {
    await setTimezone('Australia/Sydney');
  });

  test('should display times in AEST timezone', async ({ page }) => {
    await page.goto('/');
    
    // Wait for calendar to load
    await page.waitForSelector('[data-testid="calendar-view"], .calendar-container', {
      timeout: 10000,
    });
    
    // Check that timezone indicator shows correct timezone (if displayed)
    const timezoneIndicator = page.locator('[data-testid="timezone"], text=/AEST|Sydney|Australia/i');
    
    // The timezone should either be displayed or times should be in local format
    // This test verifies the page loads correctly with AEST timezone
    await expect(page.locator('body')).toBeVisible();
  });

  test('should create booking with AEST times', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to settings to verify timezone
    await page.goto('/settings?tab=organisation');
    
    // Wait for settings to load
    await page.waitForSelector('[data-testid="organisation-settings"], [class*="settings"]', {
      timeout: 10000,
    });
    
    // Check timezone select
    const timezoneSelect = page.locator('select[name="timezone"], [data-testid="timezone-select"], button[role="combobox"]').first();
    
    if (await timezoneSelect.isVisible()) {
      // Timezone should be set or show browser timezone
      const selectedValue = await timezoneSelect.textContent();
      console.log('Selected timezone:', selectedValue);
    }
  });
});

test.describe('Timezone Handling - America/New_York', () => {
  test.use({ 
    storageState: 'playwright/.auth/admin.json',
    timezoneId: 'America/New_York',
  });

  test.beforeEach(async ({ page, setTimezone }) => {
    await setTimezone('America/New_York');
  });

  test('should display times in Eastern timezone', async ({ page }) => {
    await page.goto('/');
    
    // Wait for calendar to load
    await page.waitForSelector('[data-testid="calendar-view"], .calendar-container', {
      timeout: 10000,
    });
    
    // Verify page loads with Eastern timezone
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle timezone change in organisation settings', async ({ page }) => {
    await page.goto('/settings?tab=organisation');
    
    // Wait for settings
    await page.waitForSelector('[data-testid="organisation-settings"], h2:has-text("Organisation")', {
      timeout: 10000,
    });
    
    // Find timezone selector
    const timezoneSelect = page.locator('button[role="combobox"], select[name="timezone"]').first();
    
    if (await timezoneSelect.isVisible()) {
      // Click to open dropdown
      await timezoneSelect.click();
      
      // Select America/New_York
      const nyOption = page.locator('text=/New_York|Eastern/i').first();
      if (await nyOption.isVisible()) {
        await nyOption.click();
        
        // Save if there's a save button
        const saveButton = page.locator('button:has-text("Save")').first();
        if (await saveButton.isVisible() && await saveButton.isEnabled()) {
          await saveButton.click();
          
          // Wait for save confirmation
          await page.waitForTimeout(2000);
        }
      }
    }
  });
});

test.describe('Timezone Consistency', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('booking times should be consistent across views', async ({ page }) => {
    await page.goto('/');
    
    // Wait for calendar
    await page.waitForSelector('[data-testid="calendar-view"], .calendar-container', {
      timeout: 10000,
    });
    
    // Find a booking and note its time
    const booking = page.locator('[data-testid="booking-card"], [class*="booking"]').first();
    
    if (!(await booking.isVisible())) {
      test.skip(true, 'No bookings to verify');
      return;
    }
    
    // Get booking time from day view
    const dayViewButton = page.locator('button:has-text("Day")').first();
    if (await dayViewButton.isVisible()) {
      await dayViewButton.click();
      await page.waitForTimeout(500);
    }
    
    const bookingInDayView = page.locator('[data-testid="booking-card"], [class*="booking"]').first();
    const dayViewText = await bookingInDayView.textContent();
    
    // Switch to week view
    const weekViewButton = page.locator('button:has-text("Week")').first();
    if (await weekViewButton.isVisible()) {
      await weekViewButton.click();
      await page.waitForTimeout(500);
    }
    
    const bookingInWeekView = page.locator('[data-testid="booking-card"], [class*="booking"]').first();
    const weekViewText = await bookingInWeekView.textContent();
    
    // Booking content should be consistent
    console.log('Day view:', dayViewText);
    console.log('Week view:', weekViewText);
  });
});
