# E2E Tests with Playwright

This directory contains end-to-end tests for the Dock Scheduling application.

## Setup

1. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

2. Configure test environment:
   ```bash
   cp .env.testing.example .env.testing
   # Edit .env.testing with your test credentials
   ```

3. Create test users in your Supabase project:
   - Admin user
   - Operator user
   - Viewer user
   - Super User

## Running Tests

```bash
# Run all tests
npm run test:e2e

# Run tests in UI mode (interactive)
npm run test:e2e:ui

# Run specific test file
npx playwright test e2e/auth/invite-flow.spec.ts

# Run tests with headed browser (visible)
npx playwright test --headed

# Run tests in debug mode
npx playwright test --debug
```

## Test Structure

```
e2e/
├── fixtures/
│   └── test-fixtures.ts      # Shared test utilities and fixtures
├── auth/
│   └── invite-flow.spec.ts   # Authentication tests
├── bookings/
│   ├── booking-crud.spec.ts  # Booking create/edit/delete
│   └── timezone-handling.spec.ts
├── settings/
│   └── organisation-settings.spec.ts
├── carrier/
│   └── carrier-booking.spec.ts
├── permissions/
│   └── role-access.spec.ts
├── auth.setup.ts             # Auth state setup
├── global-setup.ts           # Global test setup
└── README.md
```

## Environment Variables

Create a `.env.testing` file with:

```env
# Supabase
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Test Users (create these in your test Supabase project)
TEST_ADMIN_EMAIL=test-admin@example.com
TEST_ADMIN_PASSWORD=SecurePassword123!
TEST_OPERATOR_EMAIL=test-operator@example.com
TEST_OPERATOR_PASSWORD=SecurePassword123!
TEST_VIEWER_EMAIL=test-viewer@example.com
TEST_VIEWER_PASSWORD=SecurePassword123!
TEST_SUPER_USER_EMAIL=test-super@example.com
TEST_SUPER_USER_PASSWORD=SecurePassword123!

# Test Data
TEST_TENANT_NAME=Test Tenant
TEST_CARRIER_BOOKING_LINK_ID=your-carrier-booking-link-uuid

# Optional: Invite flow testing
TEST_INVITE_TOKEN=invite-token-uuid
TEST_INVITE_EMAIL=invited@example.com

# Playwright
PLAYWRIGHT_BASE_URL=http://localhost:8080
```

## Test Scenarios

### 🔐 Auth
- [x] Accept invite → set password → login
- [x] Login via email/password
- [x] Login via Google OAuth (if configured)
- [x] Invalid credentials handling
- [x] Protected route redirect

### 📆 Booking Flow
- [x] Create booking via UI
- [x] Edit booking (modal)
- [x] Drag and drop booking
- [x] Day view display
- [x] Week view display
- [x] Timezone handling (AEST)
- [x] Timezone handling (America/New_York)

### 🧭 Organisation Settings
- [x] Set timezone
- [x] Set working hours
- [x] Calendar respects settings

### 🚛 Carrier Booking Link
- [x] Load carrier booking page
- [x] Complete date selection
- [x] Complete time selection
- [x] Submit booking form
- [x] Verify booking appears without dock

### 👤 Permissions
- [x] Operator can't access admin routes
- [x] Operator can create bookings
- [x] Operator can't delete bookings
- [x] Super user sees tenant dropdown
- [x] Super user can switch tenants
- [x] Super user can manage all settings
- [x] Viewer can only view

## Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

Reports include:
- Screenshot on failure
- Video on failure (first retry)
- Trace on first retry

## Debugging

1. **UI Mode** - Best for writing/debugging tests:
   ```bash
   npm run test:e2e:ui
   ```

2. **Debug Mode** - Step through test:
   ```bash
   npx playwright test --debug
   ```

3. **Trace Viewer** - Analyze test failure:
   ```bash
   npx playwright show-trace trace.zip
   ```

## CI/CD Integration

The tests are configured to run in CI with:
- Sequential execution (1 worker)
- 2 retries on failure
- Video recording on retry
- HTML report generation

Add to your CI pipeline:
```yaml
- name: Run E2E tests
  run: npm run test:e2e
  env:
    CI: true
    VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
    TEST_ADMIN_EMAIL: ${{ secrets.TEST_ADMIN_EMAIL }}
    TEST_ADMIN_PASSWORD: ${{ secrets.TEST_ADMIN_PASSWORD }}
```

## Best Practices

1. **Use data-testid attributes** for reliable selectors
2. **Create test users** in a dedicated test tenant
3. **Clean up test data** after tests if needed
4. **Use fixtures** for common setup
5. **Skip tests gracefully** when prerequisites aren't met
