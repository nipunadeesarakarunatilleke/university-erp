/**
 * Generates a test JWT for manual API testing.
 * Usage: node scripts/generate-token.js
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET || 'dev-secret';
const token = jwt.sign(
  { userId: 'test-user', role: 'admin' },
  secret,
  { expiresIn: '24h' }
);

console.log('\nTest JWT Token (valid 24h):');
console.log(token);
console.log('\nUse in requests as:');
console.log('  Authorization: Bearer ' + token + '\n');
