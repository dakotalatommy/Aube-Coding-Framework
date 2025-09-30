/**
 * BrandVZN/Gemini Image Edit Test
 * 
 * Tests the live Gemini API integration through BrandVZN
 * Uses a real image to verify end-to-end image editing flow
 */

import { config as loadEnv } from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
import { initConfig, getAccessToken, apiRequest, generateIdempotencyKey } from './test-helpers';

// Load environment variables
loadEnv();

// Test configuration
const config = {
  supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  apiBaseUrl: process.env.API_BASE_URL || 'https://api.brandvx.io',
  testTenantId: process.env.TEST_TENANT_ID,
  testUserEmail: process.env.TEST_USER_EMAIL,
  testUserPassword: process.env.TEST_USER_PASSWORD,
};

// Validate configuration
function validateConfig() {
  const missing: string[] = [];
  if (!config.supabaseUrl) missing.push('VITE_SUPABASE_URL or SUPABASE_URL');
  if (!config.supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!config.supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Convert image file to base64 (with or without data URL prefix)
 */
function imageToBase64(filePath: string, includeDataUrl: boolean = true): string {
  const imageBuffer = readFileSync(filePath);
  const base64 = imageBuffer.toString('base64');
  
  if (!includeDataUrl) {
    return base64;
  }
  
  // Detect mime type from file extension
  let mimeType = 'image/jpeg';
  if (filePath.toLowerCase().endsWith('.png')) {
    mimeType = 'image/png';
  } else if (filePath.toLowerCase().endsWith('.jpg') || filePath.toLowerCase().endsWith('.jpeg')) {
    mimeType = 'image/jpeg';
  }
  
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Save base64 data URL to file
 */
function saveBase64Image(base64Data: string, outputPath: string) {
  // Extract base64 content from data URL
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid base64 data URL format');
  }
  
  const imageBuffer = Buffer.from(matches[2], 'base64');
  writeFileSync(outputPath, imageBuffer);
}

/**
 * Main test function
 */
async function testBrandVZNGemini() {
  console.log('═'.repeat(70));
  console.log('🎨 BrandVZN/Gemini Image Edit Test');
  console.log('═'.repeat(70));
  console.log(`API Base URL: ${config.apiBaseUrl}`);
  console.log('═'.repeat(70));
  console.log();

  try {
    // Initialize
    validateConfig();
    initConfig(config);

    // Step 1: Load the test image
    console.log('📸 Step 1: Loading test image...');
    const imagePath = '/Users/dakotalatommy/Aube-Coding-Framework/apps/operator-ui/src/assets/onboarding/IMG_7577.jpeg';
    // Send raw base64 without data URL prefix (Gemini API expects this)
    const imageBase64 = imageToBase64(imagePath, false);
    const imageSizeKB = Math.round(imageBase64.length / 1024);
    console.log(`✅ Image loaded: ${imageSizeKB} KB (raw base64)`);
    console.log();

    // Step 2: Get authentication token
    console.log('🔐 Step 2: Authenticating...');
    const { accessToken, tenantId, userId } = await getAccessToken();
    console.log(`✅ Authenticated as user: ${userId}`);
    console.log(`✅ Tenant: ${tenantId}`);
    console.log();

    // Step 3: Send image edit request to BrandVZN (via Gemini API)
    console.log('🎨 Step 3: Sending image edit request to BrandVZN/Gemini...');
    // Use a unique prompt each time to bypass content-based deduplication
    const uniquePrompt = `Make the image brighter and more vibrant (test-${Date.now()})`;
    console.log(`   Prompt: "${uniquePrompt}"`);
    console.log('   Preserve dimensions: true');
    
    const startTime = Date.now();
    const response = await apiRequest('POST', '/ai/tools/execute', {
      body: {
        name: 'image.edit',
        require_approval: false,
        params: {
          inputImageBase64: imageBase64,
          prompt: uniquePrompt,
          preserveDims: true,
        },
        // Omit idempotency_key to force fresh processing
        // idempotency_key: generateIdempotencyKey(),
      },
    });
    
    const duration = Date.now() - startTime;
    console.log(`   Request completed in ${(duration / 1000).toFixed(2)}s`);
    console.log();

    // Step 4: Validate response
    console.log('🔍 Step 4: Validating response...');
    
    if (!response.ok) {
      console.error(`❌ Request failed with status: ${response.status}`);
      console.error(`Response: ${JSON.stringify(response.data)}`);
      process.exit(1);
    }
    
    console.log(`✅ Status: ${response.status}`);
    
    // Check for various response formats
    let editedImageData: string | null = null;
    
    if (response.data.data_url) {
      editedImageData = response.data.data_url;
      console.log('✅ Found edited image in data_url field');
    } else if (response.data.preview_url) {
      editedImageData = response.data.preview_url;
      console.log('✅ Found edited image in preview_url field');
    } else if (response.data.result?.data_url) {
      editedImageData = response.data.result.data_url;
      console.log('✅ Found edited image in result.data_url field');
    } else if (response.data.result?.preview_url) {
      editedImageData = response.data.result.preview_url;
      console.log('✅ Found edited image in result.preview_url field');
    } else if (typeof response.data === 'string' && response.data.startsWith('data:image/')) {
      editedImageData = response.data;
      console.log('✅ Response is direct base64 image data');
    } else {
      console.log('⚠️  Response structure:');
      console.log(JSON.stringify(response.data, null, 2).substring(0, 500));
      console.log();
      
      // Check if it's a status response (like "duplicate" or "pending")
      if (response.data.status === 'duplicate') {
        console.log('⚠️  Image edit was marked as duplicate (idempotency)');
        console.log('💡 This means the request was processed but cached');
      } else if (response.data.status === 'pending' || response.data.status === 'queued') {
        console.log('⚠️  Image edit is queued for processing');
        console.log('💡 You may need to poll for results or check async job status');
      }
      
      console.log();
      console.log('❌ Could not find edited image data in response');
      console.log('📋 Full response:');
      console.log(JSON.stringify(response.data, null, 2));
      process.exit(1);
    }
    
    // Step 5: Save edited image
    console.log();
    console.log('💾 Step 5: Saving edited image...');
    const outputPath = '/Users/dakotalatommy/Aube-Coding-Framework/tests/e2e/test-output-edited.jpg';
    
    try {
      saveBase64Image(editedImageData, outputPath);
      console.log(`✅ Edited image saved to: ${outputPath}`);
      
      // Get file size
      const outputBuffer = readFileSync(outputPath);
      const outputSizeKB = Math.round(outputBuffer.length / 1024);
      console.log(`✅ Output size: ${outputSizeKB} KB`);
    } catch (error: any) {
      console.error(`❌ Failed to save image: ${error.message}`);
      process.exit(1);
    }

    // Success summary
    console.log();
    console.log('═'.repeat(70));
    console.log('✅ BrandVZN/Gemini Test PASSED');
    console.log('═'.repeat(70));
    console.log('Summary:');
    console.log(`  • Input image: ${imageSizeKB} KB`);
    console.log(`  • Processing time: ${(duration / 1000).toFixed(2)}s`);
    console.log(`  • Output image: ${outputPath}`);
    console.log(`  • Gemini API: Working ✅`);
    console.log(`  • Image editing: Working ✅`);
    console.log('═'.repeat(70));
    
    process.exit(0);
    
  } catch (error: any) {
    console.error();
    console.error('═'.repeat(70));
    console.error('❌ BrandVZN/Gemini Test FAILED');
    console.error('═'.repeat(70));
    console.error(`Error: ${error.message}`);
    if (error.stack) {
      console.error();
      console.error('Stack trace:');
      console.error(error.stack);
    }
    console.error('═'.repeat(70));
    process.exit(1);
  }
}

// Run the test
testBrandVZNGemini();
