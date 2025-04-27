// Script to check database configuration in the application
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env files
try {
  dotenv.config();
  console.log('Loaded .env file');
} catch (err) {
  console.log('No .env file found');
}

// Check for common configuration files
const configFiles = [
  'platform/wab/.env',
  'platform/wab/.env.local',
  'platform/wab/src/wab/server/config.ts',
  'platform/wab/src/wab/server/config/database.ts'
];

console.log('=== Database Configuration Check ===');

// Try to find and read configuration files
configFiles.forEach(filePath => {
  const fullPath = path.resolve(process.cwd(), filePath);
  console.log(`Checking ${filePath}...`);
  
  try {
    if (fs.existsSync(fullPath)) {
      console.log(`File exists: ${fullPath}`);
      
      if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Look for database configuration patterns
        if (content.includes('database') || content.includes('postgres') || 
            content.includes('connection') || content.includes('PGPASSWORD')) {
          console.log('Potential database configuration found:');
          
          // Extract relevant parts (simplistic approach)
          const relevantLines = content.split('\n')
            .filter(line => 
              line.includes('database') || 
              line.includes('postgres') || 
              line.includes('connection') ||
              line.includes('host') ||
              line.includes('password') ||
              line.includes('PGPASSWORD')
            )
            .map(line => line.trim());
          
          console.log(relevantLines.join('\n'));
        } else {
          console.log('No database configuration detected in this file');
        }
      } else if (filePath.endsWith('.env') || filePath.endsWith('.env.local')) {
        // For .env files, print database-related variables
        const content = fs.readFileSync(fullPath, 'utf8');
        const envVars = content.split('\n')
          .filter(line => 
            line.includes('DB_') || 
            line.includes('DATABASE_') ||
            line.includes('PG') ||
            line.includes('POSTGRES')
          )
          .map(line => line.trim());
        
        if (envVars.length > 0) {
          console.log('Database environment variables found:');
          console.log(envVars.join('\n'));
        } else {
          console.log('No database environment variables detected');
        }
      }
    } else {
      console.log(`File does not exist: ${fullPath}`);
    }
  } catch (err) {
    console.error(`Error reading ${fullPath}:`, err.message);
  }
  
  console.log('---');
});

// Check typeorm configuration
try {
  const typeormConfigPath = path.resolve(process.cwd(), 'platform/wab/ormconfig.js');
  if (fs.existsSync(typeormConfigPath)) {
    console.log('TypeORM config found, examining...');
    const content = fs.readFileSync(typeormConfigPath, 'utf8');
    
    // Extract connection info (simplified approach)
    console.log('Database connection info from TypeORM config:');
    const connectionInfo = content.split('\n')
      .filter(line => 
        line.includes('host') || 
        line.includes('port') ||
        line.includes('username') ||
        line.includes('password') ||
        line.includes('database')
      )
      .map(line => line.trim());
    
    console.log(connectionInfo.join('\n'));
  } else {
    console.log('No TypeORM config found at', typeormConfigPath);
  }
} catch (err) {
  console.error('Error checking TypeORM config:', err.message);
}

// Print environment variables that might be used for database config
console.log('\n=== Environment Variables ===');
const relevantEnvVars = [
  'DATABASE_URL', 'PGHOST', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGPORT',
  'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_PORT'
];

relevantEnvVars.forEach(varName => {
  if (process.env[varName]) {
    if (varName.includes('PASSWORD')) {
      console.log(`${varName}: [SET]`);
    } else {
      console.log(`${varName}: ${process.env[varName]}`);
    }
  } else {
    console.log(`${varName}: [NOT SET]`);
  }
});

console.log('\n=== Docker Database Information ===');
console.log('If using Docker, database password should be "password" according to docker-compose.services.yaml');
console.log('If using local development, password should be "SEKRET" according to platform/wab/tools/docker-dev/db-setup.bash'); 