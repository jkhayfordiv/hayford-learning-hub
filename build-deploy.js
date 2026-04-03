const { execSync } = require('child_process');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const APPS = [
  { name: 'hub-dashboard', distPath: 'apps/hub-dashboard/dist', zipPath: '' }, // Root of zip
  { name: 'ielts-writing', distPath: 'apps/ielts-writing/dist', zipPath: 'ielts-writing' },
  { name: 'ielts-speaking', distPath: 'apps/ielts-speaking/dist', zipPath: 'ielts-speaking' },
  { name: 'vocab-tool', distPath: 'apps/vocab-tool/dist', zipPath: 'vocab-tool' },
  { name: 'grammar-lab', distPath: 'apps/grammar-lab/dist', zipPath: 'grammar-lab' },
  { name: 'grammar-world', distPath: 'apps/grammar-world/dist', zipPath: 'grammar-world' },
  { name: 'writing-lab', distPath: 'apps/writing-lab/dist', zipPath: 'writing-lab' }
];

const OUTPUT_ZIP = 'hostinger-full-deploy.zip';
const ROOT_FILES = ['.htaccess'];

console.log('🚀 Starting Hostinger Full Deployment Build...\n');

// Step 1: Build all frontend apps sequentially
console.log('📦 Building frontend applications...\n');

for (const app of APPS) {
  console.log(`Building ${app.name}...`);
  try {
    execSync(`npm run build`, {
      cwd: path.join(__dirname, path.dirname(app.distPath)),
      stdio: 'inherit'
    });
    console.log(`✅ ${app.name} built successfully\n`);
  } catch (error) {
    console.error(`❌ Failed to build ${app.name}`);
    process.exit(1);
  }
}

// Step 2: Create deployment zip
console.log('📦 Creating deployment package...\n');

// Remove existing zip if present
if (fs.existsSync(OUTPUT_ZIP)) {
  fs.unlinkSync(OUTPUT_ZIP);
  console.log('Removed existing deployment zip\n');
}

const output = fs.createWriteStream(OUTPUT_ZIP);
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

output.on('close', () => {
  const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`\n✅ Deployment package created: ${OUTPUT_ZIP}`);
  console.log(`📊 Total size: ${sizeInMB} MB (${archive.pointer()} bytes)`);
  console.log('\n🎉 Build complete! Ready to upload to Hostinger.');
});

archive.on('error', (err) => {
  console.error('❌ Error creating zip:', err);
  process.exit(1);
});

archive.pipe(output);

for (const rootFile of ROOT_FILES) {
  const rootFilePath = path.join(__dirname, rootFile);

  if (fs.existsSync(rootFilePath)) {
    console.log(`Adding ${rootFile} to root of zip...`);
    archive.file(rootFilePath, { name: rootFile });
  }
}

// Add each app's dist folder to the zip
for (const app of APPS) {
  const distPath = path.join(__dirname, app.distPath);
  
  if (!fs.existsSync(distPath)) {
    console.error(`❌ Error: ${distPath} does not exist. Build may have failed.`);
    process.exit(1);
  }

  if (app.zipPath === '') {
    // Hub dashboard goes to root of zip
    console.log(`Adding ${app.name} to root of zip...`);
    archive.directory(distPath, false);
  } else {
    // Other apps go into their respective folders
    console.log(`Adding ${app.name} to ${app.zipPath}/ folder...`);
    archive.directory(distPath, app.zipPath);
  }
}

archive.finalize();
