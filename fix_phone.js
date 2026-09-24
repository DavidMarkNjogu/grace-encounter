const fs = require('fs');
let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf-8');
content = content.replace(
  /<p className="text-xs text-ink-soft">\{r\.phone\}<\/p>/,
  '<p className="text-xs text-ink-soft">{formatKePhoneDisplay(r.phone_canonical)}</p>'
);
fs.writeFileSync('components/AdminDashboard.tsx', content);
console.log('Fixed r.phone');
