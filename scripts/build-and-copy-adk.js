#!/usr/bin/env node

/**
 * Copy pre-built ADK dist to backend node_modules
 * The ADK dist is committed to the repo with custom GPT-5 support and custom base URL
 */

const fs = require('fs');
const path = require('path');

const adkRoot = path.join(__dirname, '..', 'adk-ts', 'packages', 'adk');
const sourceDir = path.join(adkRoot, 'dist');
const targetDir = path.join(__dirname, '..', 'backend', 'node_modules', '@iqai', 'adk');
const vendorDir = path.join(__dirname, '..', 'backend', 'vendor', '@iqai', 'adk');
const packageJsonSource = path.join(adkRoot, 'package.json');
const packageJsonTarget = path.join(targetDir, 'package.json');
const packageJsonVendor = path.join(vendorDir, 'package.json');

// Create a clean package.json without workspace: dependencies
function createDeployPackageJson(sourcePackage) {
  const pkg = JSON.parse(fs.readFileSync(sourcePackage, 'utf8'));
  
  // Remove workspace: dependencies from devDependencies
  if (pkg.devDependencies) {
    for (const dep in pkg.devDependencies) {
      if (pkg.devDependencies[dep].startsWith('workspace:')) {
        delete pkg.devDependencies[dep];
      }
    }
  }
  
  // Keep only necessary fields for deployment
  // Fix paths - remove dist/ prefix since files are already in root
  const main = pkg.main ? pkg.main.replace('dist/', '') : 'index.js';
  const types = pkg.types ? pkg.types.replace('dist/', '') : 'index.d.ts';
  
  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    main: main,
    types: types,
    dependencies: pkg.dependencies,
    peerDependencies: pkg.peerDependencies,
    peerDependenciesMeta: pkg.peerDependenciesMeta
  };
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('� Copying pre-built custom ADK to backend node_modules...');

try {
  // Check if pre-built dist exists
  if (!fs.existsSync(sourceDir)) {
    console.error('✗ Pre-built ADK dist not found:', sourceDir);
    console.log('ℹ️  Please run "npm run build" in adk-ts/packages/adk first');
    console.log('ℹ️  Skipping custom ADK, will use npm package instead');
    process.exit(0); // Don't fail the build
  }

  // Ensure target directories exist
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log('✓ Created node_modules directory:', targetDir);
  }
  
  if (!fs.existsSync(vendorDir)) {
    fs.mkdirSync(vendorDir, { recursive: true });
    console.log('✓ Created vendor directory:', vendorDir);
  }

  // Copy dist files to node_modules
  copyRecursiveSync(sourceDir, targetDir);
  console.log('✓ Copied ADK dist files to node_modules');
  
  // Copy dist files to vendor (for Heroku deployment)
  copyRecursiveSync(sourceDir, vendorDir);
  console.log('✓ Copied ADK dist files to vendor');

  // Create clean package.json without workspace dependencies
  if (fs.existsSync(packageJsonSource)) {
    const cleanPackage = createDeployPackageJson(packageJsonSource);
    
    // Copy to node_modules
    fs.writeFileSync(packageJsonTarget, JSON.stringify(cleanPackage, null, 2));
    console.log('✓ Created clean package.json in node_modules');
    
    // Copy to vendor
    fs.writeFileSync(packageJsonVendor, JSON.stringify(cleanPackage, null, 2));
    console.log('✓ Created clean package.json in vendor');
  } else {
    console.error('✗ package.json not found:', packageJsonSource);
    process.exit(1);
  }

  console.log('✅ Custom ADK copied successfully!');
  console.log('   node_modules:', targetDir);
  console.log('   vendor:', vendorDir);
} catch (error) {
  console.error('✗ Error copying ADK:', error.message);
  console.log('ℹ️  Build will continue using npm package instead');
  process.exit(0); // Don't fail the main build
}
