import { expect, it } from 'vitest';
import { isInsecureUrl } from './url.js';

it('says which addresses travel in clear outside this machine or the local network', () => {
  expect(isInsecureUrl('http://localhost:3100')).toBe(false);
  expect(isInsecureUrl('http://192.168.1.20:3100')).toBe(false);
  expect(isInsecureUrl('https://1-2-3-4.sslip.io')).toBe(false);
  expect(isInsecureUrl('http://203.0.113.5:8080')).toBe(true);
});
