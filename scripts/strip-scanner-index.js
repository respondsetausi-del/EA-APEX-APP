const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx');
let s = fs.readFileSync(p, 'utf8');

const re1 = /\n  const \[synapseOpen[\s\S]*?\}, \[insights\]\);\r?\n\r?\n  \/\/ Auth routing/;
if (!re1.test(s)) {
  console.error('re1 failed');
  process.exit(1);
}
s = s.replace(re1, '\n\n  // Auth routing');

const re2 = /\r?\n  \/\/ mm:ss formatter for the signal countdown\.[\s\S]*?\r?\n  const renderHeroBg/s;
if (!re2.test(s)) {
  console.error('re2 failed');
  process.exit(1);
}
s = s.replace(re2, '\n\n  const renderHeroBg');

const re3 = /\r?\n      \{\/\* Chart Scanner Upload Modal \*\/\}[\s\S]*?\r?\n      <TradeChatWidget glowColor=\{glowColor\} \/>/;
if (!re3.test(s)) {
  console.error('re3 failed');
  process.exit(1);
}
s = s.replace(re3, '');

fs.writeFileSync(p, s);
console.log('stripped index.tsx ok');
