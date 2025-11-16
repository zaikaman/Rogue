#!/usr/bin/env node

/**
 * Replace all ADK imports from relative paths to package name
 */

const fs = require('fs');
const path = require('path');

const backendSrcDir = path.join(__dirname, '..', 'backend', 'src');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Replace the import paths
  content = content.replace(
    /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/adk-ts\/packages\/adk\/dist\/index['"]/g,
    "from '@iqai/adk'"
  );
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✓ Updated:', filePath);
    return true;
  }
  return false;
}

function walkDir(dir) {
  let updated = 0;
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      updated += walkDir(filePath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      if (replaceInFile(filePath)) {
        updated++;
      }
    }
  }
  
  return updated;
}

console.log('🔄 Replacing ADK imports...');
const updated = walkDir(backendSrcDir);
console.log(`✅ Updated ${updated} files`);
