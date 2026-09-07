require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('--- Production Database Connection Test ---');
  console.log(`Host:     ${process.env.DB_HOST}`);
  console.log(`Database: ${process.env.DB_NAME}`);
  console.log(`User:     ${process.env.DB_USER}`);
  console.log(`Port:     ${process.env.DB_PORT || 3306}`);
  console.log(`SSL:      ${process.env.DB_SSL}`);

  const isSslEnabled = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      ssl: isSslEnabled ? { rejectUnauthorized: false } : undefined,
      connectTimeout: 10000
    });

    console.log('\n✅ Successfully connected to production database!');
    const [tables] = await connection.query('SHOW TABLES;');
    console.log(`Found ${tables.length} table(s) in database "${process.env.DB_NAME}":`);
    tables.forEach((row, i) => {
      console.log(`  ${i + 1}. ${Object.values(row)[0]}`);
    });

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    if (error.code) console.error(`Error Code: ${error.code}`);

    if (error.code === 'ETIMEDOUT') {
      console.log('\n💡 TROUBLESHOOTING ETIMEDOUT ON MONSTERASP / DATABASEASP:');
      console.log('1. External Access Blocked: MonsterASP blocks remote MySQL connections by default.');
      console.log('   Go to MonsterASP Control Panel -> MySQL Databases -> Remote Access/IP Whitelist.');
      console.log('   Add "%" (or your local IP) to allow external connections.');
      console.log('2. Production Server vs Local Dev:');
      console.log('   - When running on your local PC: use DB_HOST=db67142.public.databaseasp.net');
      console.log('   - When deployed live on MonsterASP: use DB_HOST=db67142.databaseasp.net');
    }

    process.exit(1);
  }
}

testConnection();
