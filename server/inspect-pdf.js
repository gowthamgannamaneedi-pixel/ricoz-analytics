const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const pdfPath = path.join(__dirname, 'test_output.pdf');
const content = fs.readFileSync(pdfPath);
console.log('Total file size:', content.length);
console.log('Raw text representation:');
console.log(content.toString('latin1'));
