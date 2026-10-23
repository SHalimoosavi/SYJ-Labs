import assert from 'node:assert/strict';
import test from 'node:test';
import { licenseDisplay } from './license-mapping.mjs';

test('maps a missing GitHub license to No license file', () => {
  assert.equal(licenseDisplay(null), 'No license file');
});

test('maps NOASSERTION to the explicit unrecognised-license wording', () => {
  assert.equal(licenseDisplay('NOASSERTION'), 'License file present but not recognised');
});

test('preserves MIT', () => {
  assert.equal(licenseDisplay('MIT'), 'MIT');
});

test('preserves Apache-2.0', () => {
  assert.equal(licenseDisplay('Apache-2.0'), 'Apache-2.0');
});

test('preserves an unknown SPDX identifier rather than inventing a mapping', () => {
  assert.equal(licenseDisplay('Custom-License-1.0'), 'Custom-License-1.0');
});
