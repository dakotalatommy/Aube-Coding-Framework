import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';

const SUPABASE_URL = 'https://dwfvnqajrwruprqbjxph.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3ZnZucWFqcndydXBycWJqeHBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTExMDI2MCwiZXhwIjoyMDcwNjg2MjYwfQ.oqzaO0k0A00Coz524psCWvLUtGhq0qhHqjntTnfj6vI';

const PROD_USER_ID = '2cf02a7d-ce3b-482f-9760-76d6ff09fb71';
const PROD_USER_EMAIL = 'jaydnmccutchen@gmail.com';

async function setupAuthSession() {
  console.log('\n🔐 Setting up authenticated session...');
  console.log('   User ID:', PROD_USER_ID);
  console.log('   Email:', PROD_USER_EMAIL);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Use admin API to create a session for the user
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.createSession({
      user_id: PROD_USER_ID,
    });

    if (sessionError || !sessionData?.session) {
      console.error('❌ Error creating session:', sessionError);
      process.exit(1);
    }

    const accessToken = sessionData.session.access_token;
    const refreshToken = sessionData.session.refresh_token;

    console.log('✅ Session created');
    console.log('   Access token:', accessToken.substring(0, 20) + '...');
    console.log('   Refresh token:', refreshToken.substring(0, 20) + '...');

    // Launch browser and inject the auth session
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to the production app
    await page.goto('https://124f0c6f.brandvx-operator-ui.pages.dev/');
    await page.waitForTimeout(2000);

    // Inject Supabase session into localStorage
    await page.evaluate(({ accessToken, refreshToken, userId, email }) => {
      const session = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: userId,
          email: email,
          aud: 'authenticated',
          role: 'authenticated'
        }
      };

      // Set the Supabase auth session in localStorage
      const storageKey = `sb-dwfvnqajrwruprqbjxph-auth-token`;
      localStorage.setItem(storageKey, JSON.stringify(session));
      
      console.log('✅ Auth session injected into localStorage');
    }, { accessToken, refreshToken, userId: PROD_USER_ID, email: PROD_USER_EMAIL });

    console.log('💾 Saving authenticated state...');

    // Save the authenticated state for reuse
    await context.storageState({ path: 'prod-auth-state.json' });
    
    console.log('✅ Authenticated state saved to prod-auth-state.json');
    console.log('\n🎯 Ready to run production tests with full authentication!');

    await browser.close();

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

setupAuthSession();
