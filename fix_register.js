const fs = require('fs');
let code = fs.readFileSync('components/RegisterForm.tsx', 'utf-8');

code = code.replace(
  /p_source: "self_registered",/g,
  'p_source: "self_registered",\n        p_list_number: null,'
);

fs.writeFileSync('components/RegisterForm.tsx', code);
console.log('Fixed RegisterForm');
