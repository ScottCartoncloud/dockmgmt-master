import { test, expect, generateTestId, getNextWeekday } from '../fixtures/test-fixtures';
import { format } from 'date-fns';

test.describe('Booking CRUD Operations', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  const testBookingTitle = `E2E Test Booking ${generateTestId()}`;

  test('should create a new booking via UI', async ({ page }) => {
    await page.goto('/');
    
    // Wait for calendar to load
    await page.waitForSelector('[data-testid="calendar-view"], .calendar-container, [class*="calendar"]', {
      timeout: 10000,
    });
    
    // Click on a time slot or "Add Booking" button
    // First, try to find an add button
    const addButton = page.locator('button', { hasText: /add|new|create/i }).first();
    
    if (await addButton.isVisible()) {
      await addButton.click();
    } else {
      // Click on a calendar cell to open booking modal
      const calendarCell = page.locator('[data-testid="calendar-cell"], [class*="time-slot"]').first();
      if (await calendarCell.isVisible()) {
        await calendarCell.click();
      }
    }
    
    // Wait for booking modal
    await page.waitForSelector('[role="dialog"], [data-testid="booking-modal"]', {
      timeout: 5000,
    });
    
    // Fill in booking details
    await page.fill('input[name="title"], input[placeholder*="title" i], #title', testBookingTitle);
    
    // Select date if date picker is present
    const dateInput = page.locator('input[type="date"], [data-testid="date-picker"]').first();
    if (await dateInput.isVisible()) {
      const nextWeekday = getNextWeekday();
      await dateInput.fill(format(nextWeekday, 'yyyy-MM-dd'));
    }
    
    // Fill time if needed
    const startTimeInput = page.locator('input[name="start_time"], select[name="start_time"]').first();
    if (await startTimeInput.isVisible()) {
      await startTimeInput.fill('09:00');
    }
    
    const endTimeInput = page.locator('input[name="end_time"], select[name="end_time"]').first();
    if (await endTimeInput.isVisible()) {
      await endTimeInput.fill('10:00');
    }
    
    // Fill optional fields
    const palletsInput = page.locator('input[name="pallets"], #pallets');
    if (await palletsInput.isVisible()) {
      await palletsInput.fill('5');
    }
    
    // Submit the form
    const submitButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")').first();
    await submitButton.click();
    
    // Wait for modal to close
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 5000 });
    
    // Verify booking appears in the calendar
    await expect(page.locator(`text=${testBookingTitle}`)).toBeVisible({ timeout: 10000 });
  });

  test('should edit a booking via modal', async ({ page }) => {
    await page.goto('/');
    
    // Wait for calendar to load
    await page.waitForSelector('[data-testid="calendar-view"], .calendar-container', {
      timeout: 10000,
    });
    
    // Find an existing booking card
    const bookingCard = page.locator('[data-testid="booking-card"], [class*="booking"]').first();
    
    if (!(await bookingCard.isVisible())) {
      test.skip(true, 'No existing bookings to edit');
      return;
    }
    
    // Click on the booking to open modal
    await bookingCard.click();
    
    // Wait for modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    
    // Update the title
    const titleInput = page.locator('input[name="title"], input[placeholder*="title" i], #title');
    const originalTitle = await titleInput.inputValue();
    const updatedTitle = `Updated: ${originalTitle}`;
    
    await titleInput.clear();
    await titleInput.fill(updatedTitle);
    
    // Save changes
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Update"), button[type="submit"]').first();
    await saveButton.click();
    
    // Wait for modal to close
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 5000 });
    
    // Verify updated title appears
    await expect(page.locator(`text=${updatedTitle}`)).toBeVisible({ timeout: 10000 });
  });

  test('should drag and drop booking to reschedule', async ({ page }) => {
    await page.goto('/');
    
    // Wait for calendar
    await page.waitForSelector('[data-testid="calendar-view"], .calendar-container', {
      timeout: 10000,
    });
    
    // Find a draggable booking
    const booking = page.locator('[data-testid="booking-card"][draggable="true"], [class*="booking"][draggable="true"]').first();
    
    if (!(await booking.isVisible())) {
      test.skip(true, 'No draggable bookings found');
      return;
    }
    
    // Find a target drop zone
    const dropTarget = page.locator('[data-testid="drop-zone"], [class*="time-slot"]').nth(3);
    
    if (!(await dropTarget.isVisible())) {
      test.skip(true, 'No drop target found');
      return;
    }
    
    // Get original position info
    const originalBounds = await booking.boundingBox();
    
    // Perform drag and drop
    await booking.dragTo(dropTarget);
    
    // Wait for any network requests to complete
    await page.waitForTimeout(1000);
    
    // Verify booking moved (different position)
    const newBounds = await booking.boundingBox();
    
    if (originalBounds && newBounds) {
      // Position should have changed
      expect(
        originalBounds.x !== newBounds.x || originalBounds.y !== newBounds.y
      ).toBeTruthy();
    }
  });
});

test.describe('Booking Views', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('should display booking in Day view', async ({ page }) => {
    await page.goto('/');
    
    // Switch to Day view if not already
    const dayViewButton = page.locator('button:has-text("Day"), [data-testid="day-view-btn"]');
    if (await dayViewButton.isVisible()) {
      await dayViewButton.click();
    }
    
    // Wait for view to load
    await page.waitForTimeout(1000);
    
    // Verify day view structure
    await expect(page.locator('[data-testid="day-view"], [class*="day-view"]')).toBeVisible({
      timeout: 5000,
    });
    
    // Check for time column
    const timeColumn = page.locator('[class*="time"], [data-testid="time-column"]');
    await expect(timeColumn.first()).toBeVisible();
  });

  test('should display booking in Week view', async ({ page }) => {
    await page.goto('/');
    
    // Switch to Week view
    const weekViewButton = page.locator('button:has-text("Week"), [data-testid="week-view-btn"]');
    if (await weekViewButton.isVisible()) {
      await weekViewButton.click();
    }
    
    // Wait for view to load
    await page.waitForTimeout(1000);
    
    // Verify week view structure - should show multiple days
    await expect(page.locator('[data-testid="week-view"], [class*="week-view"]')).toBeVisible({
      timeout: 5000,
    });
    
    // Should have day headers
    const dayHeaders = page.locator('[class*="day-header"], th, [data-testid="day-header"]');
    await expect(dayHeaders.first()).toBeVisible();
  });

  test('should navigate between dates', async ({ page }) => {
    await page.goto('/');
    
    // Wait for calendar header
    await page.waitForSelector('[data-testid="calendar-header"], header', {
      timeout: 10000,
    });
    
    // Get current date display
    const dateDisplay = page.locator('[data-testid="current-date"], [class*="date-display"], h1, h2').first();
    const originalDate = await dateDisplay.textContent();
    
    // Click next button
    const nextButton = page.locator('button:has-text("Next"), button[aria-label*="next"], [data-testid="next-btn"]').first();
    if (await nextButton.isVisible()) {
      await nextButton.click();
      
      // Wait for view update
      await page.waitForTimeout(500);
      
      // Date should have changed
      const newDate = await dateDisplay.textContent();
      expect(newDate).not.toBe(originalDate);
    }
  });
});
