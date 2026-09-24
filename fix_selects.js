const fs = require('fs');
let code = fs.readFileSync('components/AdminDashboard.tsx', 'utf-8');

code = code.replace(/<select([\s\S]*?)className="([^"]*)"/g, (match, before, className) => {
  if (!className.includes('cursor-pointer')) {
    return `<select${before}className="${className} cursor-pointer"`;
  }
  return match;
});

fs.writeFileSync('components/AdminDashboard.tsx', code);
console.log('Added cursor-pointer to selects');
