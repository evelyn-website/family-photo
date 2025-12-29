#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, description) {
  try {
    log(description, 'blue');
    execSync(command, { stdio: 'inherit', cwd: __dirname });
    log(`✅ ${description.replace('...', '')} completed successfully`, 'green');
    return true;
  } catch (error) {
    log(`❌ ${description.replace('...', '')} failed`, 'yellow');
    process.exit(1);
  }
}

log('🚀 Starting production deployment...\n', 'blue');

// Step 1: Deploy Convex backend
runCommand('npx convex deploy -y', '📦 Step 1: Deploying Convex backend...');

console.log('');

// Step 2: Deploy Vercel frontend
runCommand('vercel --prod --yes', '🌐 Step 2: Deploying Vercel frontend...');

console.log('');
log('🎉 Deployment complete!\n', 'green');
console.log('Next steps:');
console.log('  • Verify environment variables are set in Convex Dashboard');
console.log('  • Verify VITE_CONVEX_URL is set in Vercel Dashboard');
console.log('  • Test your production deployment');

