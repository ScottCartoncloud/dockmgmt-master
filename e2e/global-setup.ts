import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup runs once before all tests
 * Use this to:
 * - Seed test data
 * - Verify test environment is ready
 * - Create test users if needed
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Running global setup...');
  
  // Verify environment variables
  const requiredEnvVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
  ];
  
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
    console.warn('   Some tests may be skipped or fail.');
  }
  
  // Verify the app is accessible
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:8080';
  
  try {
    console.log(`📡 Checking if app is accessible at ${baseURL}...`);
    await page.goto(baseURL, { timeout: 30000 });
    console.log('✅ App is accessible');
  } catch (error) {
    console.error('❌ Could not access app. Make sure the dev server is running.');
    throw error;
  } finally {
    await browser.close();
  }
  
  // Log test configuration
  console.log('\n📋 Test Configuration:');
  console.log(`   Base URL: ${baseURL}`);
  console.log(`   Admin Email: ${process.env.TEST_ADMIN_EMAIL || '(using default)'}`);
  console.log(`   Carrier Link ID: ${process.env.TEST_CARRIER_BOOKING_LINK_ID || '(not configured)'}`);
  
  console.log('\n✅ Global setup complete\n');
}

export default globalSetup;
