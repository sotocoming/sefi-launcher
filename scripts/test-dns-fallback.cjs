const assert = require('node:assert/strict');

// Test IPv4 validator
const IPV4_REGEX = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

assert.equal(IPV4_REGEX.test('77.90.13.212'), true);
assert.equal(IPV4_REGEX.test('193.124.66.117'), true);
assert.equal(IPV4_REGEX.test('127.0.0.1'), true);
assert.equal(IPV4_REGEX.test('256.0.0.1'), false);
assert.equal(IPV4_REGEX.test('77.90.13.212; evil.com'), false);
assert.equal(IPV4_REGEX.test('not-an-ip'), false);
assert.equal(IPV4_REGEX.test(''), false);

// Test address resolution logic
const FALLBACK = {
  'mc.sotocoming.ru': '77.90.13.212',
  'sotocoming.ru': '77.90.13.212',
  'minecraft.sotocoming.ru': '193.124.66.117',
};

function resolveHost(host, active) {
  if (!active) return host;
  return FALLBACK[host.toLowerCase().trim()] || host;
}

function resolveAddress(addr, active) {
  if (!active) return addr;
  const trimmed = addr.trim();
  const colon = trimmed.lastIndexOf(':');
  const host = colon > 0 ? trimmed.slice(0, colon) : trimmed;
  const suffix = colon > 0 ? trimmed.slice(colon) : '';
  const mapped = FALLBACK[host.toLowerCase()];
  return mapped ? mapped + suffix : addr;
}

// Inactive
assert.equal(resolveHost('mc.sotocoming.ru', false), 'mc.sotocoming.ru');
assert.equal(resolveAddress('minecraft.sotocoming.ru:25565', false), 'minecraft.sotocoming.ru:25565');

// Active
assert.equal(resolveHost('mc.sotocoming.ru', true), '77.90.13.212');
assert.equal(resolveHost('MC.SOTOCOMING.RU', true), '77.90.13.212');
assert.equal(resolveHost('minecraft.sotocoming.ru', true), '193.124.66.117');
assert.equal(resolveHost('other.domain.com', true), 'other.domain.com');

assert.equal(resolveAddress('minecraft.sotocoming.ru:25565', true), '193.124.66.117:25565');
assert.equal(resolveAddress('mc.sotocoming.ru', true), '77.90.13.212');
assert.equal(resolveAddress('mc.sotocoming.ru:25566', true), '77.90.13.212:25566');
assert.equal(resolveAddress('custom.server.com:25565', true), 'custom.server.com:25565');

console.log('PASS: DNS fallback IP validation and address resolution verified');
