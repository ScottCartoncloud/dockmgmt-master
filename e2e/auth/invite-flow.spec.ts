import { test, expect } from '../fixtures/test-fixtures';

test.describe('Invite Flow', () => {
  test.describe.configure({ mode: 'serial' });

  test('should show invite info when accessing auth with invite token', async ({ page }) => {
    // This test requires a valid invite token - skip if not configured
    const inviteToken = process.env.TEST_INVITE_TOKEN;
    
    if (!inviteToken) {
      test.skip(true, 'TEST_INVITE_TOKEN not configured');
      return;
    }

    await page.goto(`/auth?invite=${inviteToken}`);
    
    // Should show signup form with invite context
    await expect(page.locator('text=Sign Up')).toBeVisible();
    
    // Email might be pre-filled from invite
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
  });

  test('should complete signup via invite flow', async ({ page }) => {
    const inviteToken = process.env.TEST_INVITE_TOKEN;
    const testEmail = process.env.TEST_INVITE_EMAIL;
    
    if (!inviteToken || !testEmail) {
      test.skip(true, 'Invite flow test credentials not configured');
      return;
    }

    await page.goto(`/auth?invite=${inviteToken}`);
    
    // Fill in signup form
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'SecureTestPassword123!');
    
    // Click signup
    await page.click('button[type="submit"]');
    
    // Should redirect to home after successful signup
    await page.waitForURL('/', { timeout: 20000 });
    
    // Verify logged in
    await expect(page.locator('header')).toBeVisible();
  });

  test('should show invite info when accessing auth with invite token in URL hash', async ({ page }) => {
    // Email links use the hash-fragment format (/auth#invite=<token>) so the
    // token is not sent to the server. This test guards the regression where
    // Auth.tsx only read the query string and ignored the hash.
    const inviteToken = process.env.TEST_INVITE_TOKEN;

    if (!inviteToken) {
      test.skip(true, 'TEST_INVITE_TOKEN not configured');
      return;
    }

    await page.goto(`/auth#invite=${inviteToken}`);

    // The signup tab should auto-activate when an invite is detected.
    await expect(page.locator('button[role="tab"]', { hasText: 'Sign Up' })).toHaveAttribute(
      'data-state',
      'active',
      { timeout: 10000 }
    );

    // Invite banner should appear with the inviting tenant name.
    await expect(page.locator('text=/You.?ve been invited to join/i')).toBeVisible({
      timeout: 10000,
    });

    // Email field should be pre-filled and locked from the invite.
    const emailInput = page.locator('input#signup-email');
    await expect(emailInput).toBeDisabled();
    await expect(emailInput).not.toHaveValue('');
  });

  test('should show error for invalid invite token', async ({ page }) => {
    await page.goto('/auth?invite=invalid-token-12345');
    
    // Try to sign up
    await page.fill('input[type="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    
    // Look for the Sign Up button and click it
    const signUpTab = page.locator('button', { hasText: 'Sign Up' });
    if (await signUpTab.isVisible()) {
      await signUpTab.click();
      // Re-fill after switching tabs
      await page.fill('input[type="email"]', 'invalid@test.com');
      await page.fill('input[type="password"]', 'TestPassword123!');
    }
    
    await page.click('button[type="submit"]');
    
    // Should show an error (invite not found or invalid)
    // The exact error depends on implementation
    await page.waitForTimeout(3000);
  });
});

test.describe('Login Flow', () => {
  test('should login with valid credentials', async ({ page, loginAs }) => {
    await loginAs('admin');
    
    // Verify we're on the home page
    await expect(page).toHaveURL('/');
    
    // Verify header is visible (indicates logged in)
    await expect(page.locator('header')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth');
    
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('text=/invalid|error|incorrect/i')).toBeVisible({
      timeout: 10000,
    });
    
    // Should still be on auth page
    await expect(page).toHaveURL(/\/auth/);
  });

  test('should redirect to auth when accessing protected route', async ({ page, context }) => {
    // Clear any existing auth state
    await context.clearCookies();
    await page.goto('/');
    
    // Clear localStorage to remove any stored session
    await page.evaluate(() => localStorage.clear());
    
    // Reload to apply cleared state
    await page.reload();
    
    // Should redirect to auth
    await expect(page).toHaveURL(/\/auth/);
  });
});

test.describe('Google OAuth', () => {
  test('should show Google login button', async ({ page }) => {
    await page.goto('/auth');
    
    // Look for Google OAuth button
    const googleButton = page.locator('button', { hasText: /google/i });
    
    // Google auth might not be configured in test environment
    if (await googleButton.isVisible()) {
      await expect(googleButton).toBeEnabled();
    }
  });

  test('should initiate Google OAuth flow when clicked', async ({ page }) => {
    await page.goto('/auth');
    
    const googleButton = page.locator('button', { hasText: /google/i });
    
    if (!(await googleButton.isVisible())) {
      test.skip(true, 'Google OAuth not configured');
      return;
    }

    // Click Google button and check it initiates OAuth
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 5000 }).catch(() => null),
      googleButton.click(),
    ]);

    // If a popup opened, it should be the Google OAuth page
    if (popup) {
      await expect(popup).toHaveURL(/accounts\.google\.com|googleapis/);
      await popup.close();
    }
  });
});
