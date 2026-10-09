const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');
code = code.replace(/dark:[^\s"']+/g, '');
// Clean up multiple spaces left behind
code = code.replace(/  +/g, ' ');
fs.writeFileSync('src/App.jsx', code);
