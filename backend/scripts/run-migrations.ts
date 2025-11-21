import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

async function runMigrations() {
  console.log('🔄 Starting database migrations...\n');

  // Parse POSTGRES_URL if available (Vercel Postgres format)
  const postgresUrl = process.env.POSTGRES_URL;
  
  if (!postgresUrl) {
    console.error('❌ POSTGRES_URL not found in environment variables');
    console.error('Please set POSTGRES_URL or individual DB_* variables');
    process.exit(1);
  }

  console.log(`📡 Connecting to database...`);
  console.log(`   Host: ${postgresUrl.split('@')[1]?.split('/')[0] || 'unknown'}\n`);

  const dataSource = new DataSource({
    type: 'postgres',
    url: postgresUrl,
    ssl: process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } 
      : undefined,
    migrations: ['dist/database/migrations/*.js'],
    migrationsTableName: 'migrations',
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected\n');

    console.log('📦 Running migrations...\n');
    const migrations = await dataSource.runMigrations();
    
    if (migrations.length === 0) {
      console.log('✅ No pending migrations. Database is up to date!\n');
    } else {
      console.log(`✅ Successfully ran ${migrations.length} migration(s):\n`);
      migrations.forEach((migration) => {
        console.log(`   - ${migration.name}`);
      });
      console.log('');
    }

    await dataSource.destroy();
    console.log('✅ Migrations completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

runMigrations();

