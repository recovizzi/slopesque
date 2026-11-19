import { describe, expect, it } from 'vitest';
import { canonicalCode, codeStrength, newCode, tidyCode } from './code.js';
import { newKey, normalizeKey } from './key.js';

describe('user code', () => {
  it('draws 4 groups of 4 signs of the alphabet, strong', () => {
    const c = newCode();
    expect(c).toMatch(/^[A-HJKMNP-Z2-9]{4}(-[A-HJKMNP-Z2-9]{4}){3}$/);
    expect(codeStrength(c).level).toBe(3);
  });
  it('is the same whatever the case, dashes or spaces', () => {
    expect(canonicalCode('prune galop 4827 zest')).toBe(canonicalCode('PRUNE-GALOP-4827-ZEST'));
    expect(tidyCode('  jardin  pluie 7 ')).toBe('JARDIN-PLUIE-7');
  });
  it('grades a code chosen by hand (the maquette\'s cases)', () => {
    const lv = (s: string) => codeStrength(s).level;
    expect(lv('chat')).toBe(1);
    expect(codeStrength('lapin-1234-rouge').reason).toMatch(/1234/);
    expect(codeStrength('azertyuiop12').reason).toMatch(/AZERTY/);
    expect(codeStrength('aaaa-bcde-fghj').reason).toMatch(/AAAA/);
    expect(lv('jardin pluie 7')).toBe(2);
    expect(lv('lapin-rouge-vole-26')).toBe(3);
    expect(lv('café-crème-2026')).toBe(0);
  });
});

describe('room key', () => {
  it('normalizes what is typed', () => {
    expect(normalizeKey('k7qp m2xd')).toBe('K7QP-M2XD');
    expect(normalizeKey('K7QP-M2XO')).toBeNull();
    expect(normalizeKey(newKey())).not.toBeNull();
  });
});
