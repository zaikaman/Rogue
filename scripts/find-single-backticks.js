const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../backend/src/prompts/language-templates.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('🔍 Searching for single backticks (not part of code blocks)...\n');

lines.forEach((line, index) => {
  // Skip code block delimiters
  if (line.trim().match(/^\\`\\`\\`/)) return;
  
  // Look for single backtick patterns: `word`
  // But NOT: ``` or `` or \` (escaped)
  const singleBacktickPattern = /(?<!\\)(?<!`)(`[a-zA-Z][a-zA-Z0-9_.-]*`)(?!`)/g;
  const matches = line.match(singleBacktickPattern);
  
  if (matches) {
    console.log(`Line ${index + 1}: ${matches.join(', ')}`);
    console.log(`  ${line.trim().substring(0, 100)}\n`);
  }
});

console.log('\n✅ Search complete');
