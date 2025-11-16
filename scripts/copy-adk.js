#!/usr/bin/env node

/**
 * Copy local ADK dist files to backend node_modules
 * This ensures TypeScript can find type declarations during Vercel build
 */

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'adk-ts', 'packages', 'adk', 'dist');
const targetDirNodeModules = path.join(__dirname, '..', 'backend', 'node_modules', '@iqai', 'adk');
const targetDirVendor = path.join(__dirname, '..', 'backend', 'vendor', '@iqai', 'adk');
const packageJsonSource = path.join(__dirname, '..', 'adk-ts', 'packages', 'adk', 'package.json');

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

console.log('📦 Copying local ADK to backend node_modules and vendor...');

try {
  // Check source exists
  if (!fs.existsSync(sourceDir)) {
    console.error('✗ Source directory not found:', sourceDir);
    process.exit(1);
  }

  if (!fs.existsSync(packageJsonSource)) {
    console.error('✗ package.json not found:', packageJsonSource);
    process.exit(1);
  }

  // Copy to node_modules (for local development)
  if (!fs.existsSync(targetDirNodeModules)) {
    fs.mkdirSync(targetDirNodeModules, { recursive: true });
    console.log('✓ Created node_modules target directory');
  }
  copyRecursiveSync(sourceDir, targetDirNodeModules);
  fs.copyFileSync(packageJsonSource, path.join(targetDirNodeModules, 'package.json'));
  console.log('✓ Copied ADK dist files to node_modules');

  // Copy to vendor (for Heroku deployment) with cleaned package.json
  if (!fs.existsSync(targetDirVendor)) {
    fs.mkdirSync(targetDirVendor, { recursive: true });
    console.log('✓ Created vendor target directory');
  }
  copyRecursiveSync(sourceDir, targetDirVendor);
  
  // Clean package.json for vendor (remove workspace dependencies)
  const packageJson = JSON.parse(fs.readFileSync(packageJsonSource, 'utf8'));
  if (packageJson.devDependencies) {
    // Remove all workspace: dependencies
    Object.keys(packageJson.devDependencies).forEach(key => {
      if (packageJson.devDependencies[key].startsWith('workspace:')) {
        delete packageJson.devDependencies[key];
      }
    });
  }
  fs.writeFileSync(
    path.join(targetDirVendor, 'package.json'), 
    JSON.stringify(packageJson, null, '\t')
  );
  console.log('✓ Copied ADK dist files to vendor (cleaned package.json)');

  console.log('✅ ADK copied successfully!');
  console.log('   node_modules: backend/node_modules/@iqai/adk');
  console.log('   vendor: backend/vendor/@iqai/adk');
} catch (error) {
  console.error('✗ Error copying ADK:', error.message);
  process.exit(1);
}
