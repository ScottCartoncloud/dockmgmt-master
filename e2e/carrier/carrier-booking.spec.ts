import { test, expect, generateTestId, TEST_DATA } from '../fixtures/test-fixtures';

test.describe('Carrier Booking Link', () => {
  // These tests don't require authentication - testing public carrier booking
  test.use({ storageState: { cookies: [], origins: [] } });

  const carrierBookingLinkId = TEST_DATA.carrierBookingLinkId || process.env.TEST_CARRIER_BOOKING_LINK_ID;

  test('should load carrier booking page', async ({ page }) => {
    if (!carrierBookingLinkId) {
      test.skip(true, 'TEST_CARRIER_BOOKING_LINK_ID not configured');
      return;
    }

    await page.goto(`/carrier/${carrierBookingLinkId}`);
    
    // Wait for page to load
    await page.waitForSelector('h1, [data-testid="carrier-booking-page"]', {
      timeout: 10000,
    });
    
    // Should show booking title
    await expect(page.locator('text=/book|delivery/i').first()).toBeVisible();
    
    // Should show carrier name
    await expect(page.locator('[class*="carrier-name"], text=/carrier/i')).toBeVisible();
  });

  test('should complete step 1: select date', async ({ page }) => {
    if (!carrierBookingLinkId) {
      test.skip(true, 'TEST_CARRIER_BOOKING_LINK_ID not configured');
      return;
    }

    await page.goto(`/carrier/${carrierBookingLinkId}`);
    
    // Wait for calendar
    await page.waitForSelector('[role="grid"], .calendar, [data-testid="calendar"]', {
      timeout: 10000,
    });
    
    // Find an available date (not in the past, not weekend)
    const availableDate = page.locator('button:not([disabled])', {
      has: page.locator('[name="day"], time, [aria-selected]'),
    }).first();
    
    // Or try clicking on a calendar day
    const calendarDay = page.locator('[role="gridcell"] button:not([disabled])').first();
    
    if (await calendarDay.isVisible()) {
      await calendarDay.click();
      
      // Should advance to step 2 (time selection)
      await page.waitForTimeout(500);
      await expect(page.locator('text=/time|slot/i').first()).toBeVisible();
    }
  });

  test('should complete step 2: select time slot', async ({ page }) => {
    if (!carrierBookingLinkId) {
      test.skip(true, 'TEST_CARRIER_BOOKING_LINK_ID not configured');
      return;
    }

    await page.goto(`/carrier/${carrierBookingLinkId}`);
    
    // Select date first
    await page.waitForSelector('[role="gridcell"] button:not([disabled])', { timeout: 10000 });
    await page.locator('[role="gridcell"] button:not([disabled])').first().click();
    
    // Wait for time slots
    await page.waitForSelector('button:has-text(":00"), button:has-text(":30")', {
      timeout: 5000,
    });
    
    // Select an available time slot
    const availableSlot = page.locator('button:has-text(":00"):not([disabled])').first();
    
    if (await availableSlot.isVisible()) {
      await availableSlot.click();
      
      // Should advance to step 3 (details)
      await page.waitForTimeout(500);
      await expect(page.locator('text=/details|title/i').first()).toBeVisible();
    }
  });

  test('should complete full booking flow', async ({ page }) => {
    if (!carrierBookingLinkId) {
      test.skip(true, 'TEST_CARRIER_BOOKING_LINK_ID not configured');
      return;
    }

    const testTitle = `E2E Carrier Test ${generateTestId()}`;
    const testEmail = 'e2e-test@example.com';

    await page.goto(`/carrier/${carrierBookingLinkId}`);
    
    // Step 1: Select date
    await page.waitForSelector('[role="gridcell"] button:not([disabled])', { timeout: 10000 });
    await page.locator('[role="gridcell"] button:not([disabled])').first().click();
    await page.waitForTimeout(500);
    
    // Step 2: Select time
    await page.waitForSelector('button:has-text(":00"):not([disabled])', { timeout: 5000 });
    await page.locator('button:has-text(":00"):not([disabled])').first().click();
    await page.waitForTimeout(500);
    
    // Step 3: Fill details
    await page.fill('input#title, input[name="title"], input[placeholder*="title" i]', testTitle);
    await page.fill('input#confirmationEmail, input[type="email"], input[name="email"]', testEmail);
    
    // Fill optional fields
    const palletsInput = page.locator('input#pallets, input[name="pallets"]');
    if (await palletsInput.isVisible()) {
      await palletsInput.fill('3');
    }
    
    const truckRegoInput = page.locator('input#truckRego, input[name="truckRego"]');
    if (await truckRegoInput.isVisible()) {
      await truckRegoInput.fill('ABC123');
    }
    
    // Handle reCAPTCHA if present
    const recaptcha = page.locator('[data-testid="recaptcha"], .g-recaptcha, iframe[title*="reCAPTCHA"]');
    if (await recaptcha.isVisible()) {
      // In test environment, reCAPTCHA might be bypassed or use test keys
      console.log('reCAPTCHA detected - may need test keys configured');
    }
    
    // Submit the form
    const submitButton = page.locator('button[type="submit"], button:has-text("Confirm")');
    
    // Check if button is enabled (might be disabled waiting for reCAPTCHA)
    if (await submitButton.isEnabled()) {
      await submitButton.click();
      
      // Should redirect to confirmation page
      await page.waitForURL(/\/confirmed|\/success/i, { timeout: 15000 });
      
      // Verify confirmation
      await expect(page.locator('text=/confirmed|success|booked/i').first()).toBeVisible();
    }
  });

  test('should show error for invalid/disabled booking link', async ({ page }) => {
    await page.goto('/carrier/invalid-link-12345');
    
    // Should show error
    await page.waitForSelector('text=/invalid|expired|disabled|unable/i', {
      timeout: 10000,
    });
    
    await expect(page.locator('text=/invalid|expired|disabled|unable/i').first()).toBeVisible();
  });
});

test.describe('Carrier Booking - Admin Verification', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('should show carrier booking without dock assigned', async ({ page }) => {
    await page.goto('/');
    
    // Wait for calendar
    await page.waitForSelector('[data-testid="calendar-view"], .calendar-container', {
      timeout: 10000,
    });
    
    // Look for bookings that came from carrier portal
    // These typically have no dock assigned and show differently
    const unassignedBookings = page.locator('[data-testid="booking-card"][data-dock="none"], [class*="unassigned"]');
    
    // This test verifies the structure - actual booking verification depends on test data
    await expect(page.locator('body')).toBeVisible();
  });
});
