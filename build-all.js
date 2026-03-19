#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Universal Build & Package Script for Hostinger Deployment\n');

const APPS_DIR = path.join(__dirname, 'apps');
const OUTPUT_ZIP = path.join(__dirname, 'hostinger-full-deploy.zip');
const TEMP_DIR = path.join(__dirname, 'temp-deploy');

// Apps to skip (backend only)
const SKIP_APPS = ['hub-backend'];

// Main app that goes to root
const MAIN_APP = 'hub-dashboard';

// Clean up old files
console.log('🧹 Cleaning up old deployment files...');
if (fs.existsSync(OUTPUT_ZIP)) {
  fs.unlinkSync(OUTPUT_ZIP);
  console.log('   ✓ Deleted old hostinger-full-deploy.zip');
}
if (fs.existsSync(TEMP_DIR)) {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TEMP_DIR, { recursive: true });

// Discover all apps
const apps = fs.readdirSync(APPS_DIR).filter(dir => {
  const appPath = path.join(APPS_DIR, dir);
  return fs.statSync(appPath).isDirectory() && !SKIP_APPS.includes(dir);
});

console.log(`\n📦 Found ${apps.length} frontend apps to build:`);
apps.forEach(app => console.log(`   - ${app}`));

// Build each app
console.log('\n🔨 Building all apps...\n');
const builtApps = [];

for (const app of apps) {
  const appPath = path.join(APPS_DIR, app);
  const packageJsonPath = path.join(appPath, 'package.json');
  
  // Check if package.json exists
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`   ⚠️  Skipping ${app} (no package.json found)`);
    continue;
  }
  
  // Check if build script exists
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (!packageJson.scripts || !packageJson.scripts.build) {
    console.log(`   ⚠️  Skipping ${app} (no build script found)`);
    continue;
  }
  
  console.log(`   🔨 Building ${app}...`);
  try {
    execSync('npm run build', { 
      cwd: appPath, 
      stdio: 'inherit',
      shell: true
    });
    
    const distPath = path.join(appPath, 'dist');
    if (fs.existsSync(distPath)) {
      builtApps.push({ name: app, distPath });
      console.log(`   ✅ ${app} built successfully\n`);
    } else {
      console.log(`   ⚠️  ${app} built but no dist folder found\n`);
    }
  } catch (error) {
    console.error(`   ❌ Failed to build ${app}:`, error.message);
    console.log('');
  }
}

// Package all apps
console.log('\n📦 Packaging apps into hostinger-full-deploy.zip...\n');

// Copy files to temp directory
for (const { name, distPath } of builtApps) {
  if (name === MAIN_APP) {
    // Main app goes to root
    console.log(`   📁 Copying ${name} to ROOT of zip...`);
    copyRecursiveSync(distPath, TEMP_DIR);
  } else {
    // Other apps go to subfolders
    const targetDir = path.join(TEMP_DIR, name);
    console.log(`   📁 Copying ${name} to ${name}/ subfolder...`);
    fs.mkdirSync(targetDir, { recursive: true });
    copyRecursiveSync(distPath, targetDir);
  }
}

// Create zip file using PowerShell
console.log('\n   🗜️  Creating zip archive...');
try {
  execSync(`powershell -Command "Compress-Archive -Path '${TEMP_DIR}\\*' -DestinationPath '${OUTPUT_ZIP}' -Force"`, {
    stdio: 'inherit',
    shell: true
  });
  
  const stats = fs.statSync(OUTPUT_ZIP);
  const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
  
  console.log(`\n✅ SUCCESS! hostinger-full-deploy.zip created (${sizeInMB} MB)`);
  console.log(`\n📋 Package Structure:`);
  console.log(`   Root (/) = ${MAIN_APP} contents`);
  builtApps.filter(a => a.name !== MAIN_APP).forEach(({ name }) => {
    console.log(`   /${name}/ = ${name} contents`);
  });
  console.log('\n🚀 Ready to upload to Hostinger!\n');
  
  // Clean up temp directory
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
} catch (error) {
  console.error('❌ Failed to create zip file:', error.message);
  process.exit(1);
}

// Helper function to copy directories recursively
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}
