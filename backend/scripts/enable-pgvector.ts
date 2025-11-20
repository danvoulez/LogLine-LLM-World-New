import { Client } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.production' });

async function enablePgVector() {
  const postgresUrl = process.env.POSTGRES_URL;

  if (!postgresUrl) {
    console.error('❌ POSTGRES_URL not found in environment variables');
    console.log('💡 Make sure you have:');
    console.log('   1. Created Vercel Postgres database');
    console.log('   2. Run: vercel env pull .env.production');
    process.exit(1);
  }

  console.log('🔌 Connecting to database...');
  const client = new Client({
    connectionString: postgresUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    console.log('📦 Enabling pgvector extension...');
    const result = await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    
    console.log('✅ pgvector extension enabled successfully!');
    console.log('📊 Result:', result);

    // Verify it's enabled
    const checkResult = await client.query(
      "SELECT * FROM pg_extension WHERE extname = 'vector';"
    );
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Verification: pgvector is installed');
      console.log('📋 Extension details:', checkResult.rows[0]);
    }

  } catch (error) {
    console.error('❌ Error enabling pgvector:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Connection closed');
  }
}

enablePgVector();

