const db = require('../config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const connection = await db.getConnection();
  try {
    // Read the migration file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../migrations/update_profile_picture_column.sql'),
      'utf8'
    );

    // Execute the migration
    await connection.query(migrationSQL);
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the migration
runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 