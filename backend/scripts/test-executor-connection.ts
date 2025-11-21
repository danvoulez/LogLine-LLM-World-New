import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local or .env
dotenv.config({ path: '../.env.local' });
dotenv.config({ path: '../.env' });

async function testExecutorConnection() {
  const executorUrl = process.env.LOGLINE_EXECUTOR_URL;
  const sharedSecret = process.env.LOGLINE_SHARED_SECRET;

  console.log('--- Testing Executor Connection ---');
  console.log(`URL: ${executorUrl}`);
  console.log(`Secret: ${sharedSecret ? '***' : 'MISSING'}`);

  if (!executorUrl || !sharedSecret) {
    console.error('❌ Missing LOGLINE_EXECUTOR_URL or LOGLINE_SHARED_SECRET env vars.');
    process.exit(1);
  }

  const payload = {
    tool_id: 'code_interpreter',
    input: {
      language: 'python',
      code: 'print("Hello from LogLine Backend Integration Test!")'
    },
    context: {
      runId: 'test-run-id',
      tenantId: 'test-tenant-id'
    }
  };

  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', sharedSecret)
    .update(body)
    .digest('hex');

  const timestamp = Date.now().toString();

  console.log('\nSending payload:', body);
  console.log('Signature:', signature);
  console.log('Timestamp:', timestamp);

  try {
    const response = await fetch(`${executorUrl}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LogLine-Signature': signature,
        'X-LogLine-Timestamp': timestamp
      },
      body: body
    });

    const responseText = await response.text();
    console.log(`\nResponse Status: ${response.status} ${response.statusText}`);
    
    try {
      const json = JSON.parse(responseText);
      console.log('Response Body:', JSON.stringify(json, null, 2));
      
      if (response.ok && json.result && json.result.stdout && json.result.stdout.includes('Hello from LogLine')) {
        console.log('\n✅ SUCCESS: Executor executed code correctly!');
      } else {
        console.log('\n⚠️  Executed, but output was not as expected.');
      }

    } catch (e) {
      console.log('Response Body (Raw):', responseText);
    }

  } catch (error: any) {
    console.error('\n❌ Connection Failed:', error.message);
  }
}

testExecutorConnection();

