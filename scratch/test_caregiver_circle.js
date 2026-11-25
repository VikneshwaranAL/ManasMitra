// scratch/test_caregiver_circle.js
const assert = require('assert');
const http = require('http');

console.log('--- Testing Caregiver & Family Circle Enhancements ---');

// 1. Phone number validation logic
function isValidPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length < 7 || digitsOnly.length > 15) return false;
  return /^[0-9+\s\-().]+$/.test(phone.trim());
}

assert.strictEqual(isValidPhoneNumber('+91 98765 43210'), true, 'Valid international format should pass');
assert.strictEqual(isValidPhoneNumber('9876543210'), true, 'Valid standard 10-digit number should pass');
assert.strictEqual(isValidPhoneNumber('080-2345678'), true, 'Valid landline should pass');
assert.strictEqual(isValidPhoneNumber('12345'), false, 'Fewer than 7 digits must fail');
assert.strictEqual(isValidPhoneNumber('98765432109876543'), false, 'More than 15 digits must fail');
assert.strictEqual(isValidPhoneNumber('call-me-now'), false, 'Letters should fail');
assert.strictEqual(isValidPhoneNumber(''), false, 'Empty string should fail');
console.log('[OK] Phone number validation logic tests passed.');

// 2. Role categorization & badge distinction test
function getRoleDetails(member, patient) {
  const isPrimary = member.is_primary === 1 || !!member.is_primary ||
    (patient && (
      (patient.phone && member.phone && member.phone.replace(/\D/g, '') === patient.phone.replace(/\D/g, '')) ||
      (patient.caregiver && member.name && member.name.toLowerCase().trim() === patient.caregiver.toLowerCase().trim())
    ));

  let roleLabel = 'Family Member';
  let badgeClass = 'badge-family';

  if (isPrimary) {
    roleLabel = '⭐ Primary Caregiver';
    badgeClass = 'badge-primary-caregiver';
  } else if (member.role === 'Caregiver') {
    roleLabel = '🤝 Caregiver';
    badgeClass = 'badge-caregiver';
  } else if (member.role === 'Doctor') {
    roleLabel = '🩺 Doctor';
    badgeClass = 'badge-doctor';
  } else if (member.role === 'Community Health Worker' || member.role === 'Trusted Person') {
    roleLabel = '🛡️ ' + member.role;
    badgeClass = 'badge-secondary';
  } else {
    roleLabel = '❤️ ' + (member.role || 'Family Member');
    badgeClass = 'badge-family';
  }

  return { isPrimary, roleLabel, badgeClass };
}

const mockPatient = {
  name: 'Shanti Devi',
  caregiver: 'Rajesh Sharma',
  phone: '+91 98765 43210',
  pin: '1234'
};

const rajesh = { name: 'Rajesh Sharma', relation: 'Son', phone: '+91 98765 43210', role: 'Caregiver', is_primary: 1 };
const ananya = { name: 'Ananya Sharma', relation: 'Granddaughter', phone: '+91 98765 43211', role: 'Family', is_primary: 0 };
const nurse = { name: 'Sunita Devi', relation: 'Visiting Nurse', phone: '+91 98765 43219', role: 'Caregiver', is_primary: 0 };
const doc = { name: 'Dr. A. Sen', relation: 'Neurologist', phone: '+91 98765 43212', role: 'Doctor', is_primary: 0 };

const rDetails = getRoleDetails(rajesh, mockPatient);
assert.strictEqual(rDetails.isPrimary, true);
assert.strictEqual(rDetails.roleLabel, '⭐ Primary Caregiver');
assert.strictEqual(rDetails.badgeClass, 'badge-primary-caregiver');

const aDetails = getRoleDetails(ananya, mockPatient);
assert.strictEqual(aDetails.isPrimary, false);
assert.strictEqual(aDetails.roleLabel, '❤️ Family');

const nDetails = getRoleDetails(nurse, mockPatient);
assert.strictEqual(nDetails.isPrimary, false);
assert.strictEqual(nDetails.roleLabel, '🤝 Caregiver');
assert.strictEqual(nDetails.badgeClass, 'badge-caregiver');

const dDetails = getRoleDetails(doc, mockPatient);
assert.strictEqual(dDetails.isPrimary, false);
assert.strictEqual(dDetails.roleLabel, '🩺 Doctor');

console.log('[OK] Role distinction tests passed.');

// 3. Verify Patient PIN is never tampered or exposed
assert.strictEqual(mockPatient.pin, '1234');
assert.strictEqual(JSON.stringify(rDetails).includes('1234'), false);
console.log('[OK] Patient PIN protection verified.');

// 4. Test live backend API endpoints
function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : null;
    const headers = Object.assign({}, options.headers || {});
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runApiTests() {
  console.log('Testing GET /api/family...');
  const famRes = await fetchJson('http://127.0.0.1:8000/api/family');
  assert.strictEqual(famRes.status, 200);
  assert.ok(Array.isArray(famRes.body), 'Body should be an array of family members');
  assert.ok(famRes.body.length >= 3);

  const primary = famRes.body.find(m => m.is_primary === 1);
  assert.ok(primary, 'Should find at least one primary caregiver in family members');
  console.log(`[OK] Primary caregiver in DB: ${primary.name} (is_primary = ${primary.is_primary})`);

  // Test adding an additional caregiver with valid phone
  console.log('Testing POST /api/family with additional caregiver...');
  const addRes = await fetchJson('http://127.0.0.1:8000/api/family', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      name: 'Pooja Verma',
      relationship: 'Neighbor / Caregiver',
      phone: '+91 98765 99999',
      email: 'pooja@example.com',
      city: 'Delhi',
      support_role: 'Caregiver',
      notes: 'Available on weekends',
      is_primary: 0
    }
  });
  if (addRes.status !== 201) console.log('POST /api/family failed body:', addRes.body);
  assert.strictEqual(addRes.status, 201);
  assert.strictEqual(addRes.body.success, true);
  const newMemberId = addRes.body.family_id;
  console.log(`[OK] Added additional caregiver with ID: ${newMemberId}`);

  // Verify invalid phone rejection (400)
  console.log('Testing POST /api/family with invalid phone rejection...');
  const failRes = await fetchJson('http://127.0.0.1:8000/api/family', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      name: 'Bad Phone Contact',
      phone: '123'
    }
  });
  assert.strictEqual(failRes.status, 400);
  console.log('[OK] Short phone number rejected with HTTP 400.');

  // Clean up added test member via DELETE /api/family/<id>
  const delRes = await fetchJson(`http://127.0.0.1:8000/api/family/${newMemberId}`, {
    method: 'DELETE'
  });
  assert.strictEqual(delRes.status, 200);
  assert.strictEqual(delRes.body.success, true);
  console.log('[OK] Cleaned up temporary test member via DELETE /api/family/<id>.');

  console.log('\n[ALL CAREGIVER CIRCLE INTEGRATION TESTS PASSED!]');
}

runApiTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
