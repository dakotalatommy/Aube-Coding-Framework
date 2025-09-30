import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dwfvnqajrwruprqbjxph.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3ZnZucWFqcndydXBycWJqeHBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTExMDI2MCwiZXhwIjoyMDcwNjg2MjYwfQ.oqzaO0k0A00Coz524psCWvLUtGhq0qhHqjntTnfj6vI';

const TEST_USER_EMAIL = 'playwright-test@brandvx.test';
const TEST_USER_PASSWORD = 'PlaywrightTest123!@#';

async function setupTestUser() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('🔧 Setting up test user...');

  try {
    // Try to get existing user
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === TEST_USER_EMAIL);

    if (existingUser) {
      console.log('✅ Test user already exists:', TEST_USER_EMAIL);
      console.log('   User ID:', existingUser.id);
    } else {
      // Create new test user
      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        email_confirm: true,
        user_metadata: {
          name: 'Playwright Test User',
          test_user: true
        }
      });

      if (error) {
        console.error('❌ Error creating test user:', error);
        process.exit(1);
      }

      console.log('✅ Created test user:', TEST_USER_EMAIL);
      console.log('   User ID:', newUser.user?.id);
    }

    console.log('\n📋 Test Credentials:');
    console.log('   Email:', TEST_USER_EMAIL);
    console.log('   Password:', TEST_USER_PASSWORD);
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

setupTestUser();

export { TEST_USER_EMAIL, TEST_USER_PASSWORD };
