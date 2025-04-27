const { Pool } = require('pg');

// Try different possible passwords
const passwords = ['SEKRET', 'password', ''];
const host = process.env.PG_HOST || 'localhost';
const user = 'wab';
const database = 'wab';

async function tryConnect(password) {
  console.log(`Trying to connect with password: "${password}"`);
  
  const pool = new Pool({
    user,
    host,
    database,
    password,
    port: 5432,
  });

  try {
    // Try to connect
    const client = await pool.connect();
    console.log('✅ CONNECTION SUCCESSFUL');
    
    // Get server info
    const res = await client.query('SELECT version()');
    console.log('PostgreSQL version:', res.rows[0].version);
    
    // Check user info
    const userRes = await client.query('SELECT current_user, current_database()');
    console.log('Current user:', userRes.rows[0].current_user);
    console.log('Current database:', userRes.rows[0].current_database);
    
    client.release();
    await pool.end();
    return true;
  } catch (err) {
    console.error('❌ CONNECTION FAILED:', err.message);
    await pool.end();
    return false;
  }
}

async function main() {
  console.log('=== PostgreSQL Connection Diagnostics ===');
  console.log(`Trying to connect to ${host} as user "${user}"`);
  
  for (const password of passwords) {
    const succeeded = await tryConnect(password);
    if (succeeded) break;
  }
  
  console.log('\n=== Environment Check ===');
  // Print relevant environment variables that might affect the connection
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('PG_HOST:', process.env.PG_HOST);
  console.log('PGHOST:', process.env.PGHOST);
  console.log('PGPASSWORD:', process.env.PGPASSWORD ? '[SET]' : '[NOT SET]');
  console.log('PG_USER:', process.env.PG_USER);
  
  console.log('\n=== Docker Container Info ===');
  console.log('If you\'re using Docker, check that:');
  console.log('1. Your container is running: docker ps');
  console.log('2. The database is properly initialized');
  console.log('3. Network connectivity between application and database');
}

main().catch(err => {
  console.error('Error in diagnostics script:', err);
  process.exit(1);
}); 