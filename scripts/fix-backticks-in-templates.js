const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../backend/src/prompts/language-templates.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace: Do NOT wrap JSON in ```json code fences
// With: Do NOT wrap JSON in triple-backtick json code fences
content = content.replace(
  /Do NOT wrap JSON in \\`\\`\\`json code fences/g,
  'Do NOT wrap JSON in triple-backtick json code fences'
);

// Save
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Fixed backticks in language-templates.ts');
