// scratch/verify_dom_and_assets.js
const fs = require('fs');
const assert = require('assert');

console.log('--- Verifying HTML and CSS assets for Caregiver features ---');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const js = fs.readFileSync('script.js', 'utf8');

// 1. Check HTML elements
assert.ok(html.includes('id="fam-is-primary"'), 'Checkbox #fam-is-primary must exist in index.html');
assert.ok(html.includes('id="fam-phone"'), 'Input #fam-phone must exist in index.html');
assert.ok(html.includes('Designate as Primary Caregiver'), 'Primary Caregiver checkbox label must exist in index.html');
assert.ok(html.includes('7 to 15 digit'), 'Phone format hint must exist in index.html');
console.log('[OK] index.html elements verified.');

// 2. Check CSS classes
assert.ok(css.includes('.primary-caregiver-card'), '.primary-caregiver-card must exist in style.css');
assert.ok(css.includes('.badge-primary-caregiver'), '.badge-primary-caregiver must exist in style.css');
assert.ok(css.includes('.primary-caregiver-toggle-group'), '.primary-caregiver-toggle-group must exist in style.css');
console.log('[OK] style.css styling rules verified.');

// 3. Check JS integration
assert.ok(js.includes('isValidPhoneNumber'), 'isValidPhoneNumber must be in script.js');
assert.ok(js.includes('badge-primary-caregiver'), 'badge-primary-caregiver must be referenced in script.js');
assert.ok(js.includes('fam-is-primary'), 'fam-is-primary must be read in script.js');
assert.ok(js.includes('href="tel:'), 'tel: link must be rendered in script.js');
console.log('[OK] script.js integration verified.');

console.log('\n[ALL DOM & ASSET CHECKS PASSED!]');
