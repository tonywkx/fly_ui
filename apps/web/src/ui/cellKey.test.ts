import { describe, expect, it } from 'vitest';
import { cellKey } from './cellKey';

describe('cellKey', () => {
  it('names the key cells by type', () => {
    expect(cellKey('DNp01')).toBe('why.cell.DNp01');
    expect(cellKey('LC4')).toBe('why.cell.LC4');
    expect(cellKey('LPLC2')).toBe('why.cell.LPLC2');
    expect(cellKey('TTMn')).toBe('why.cell.TTMn');
    expect(cellKey('pIP10')).toBe('why.cell.pIP10');
  });

  it('folds subtypes into their family', () => {
    expect(cellKey('LB3a')).toBe('why.cell.LB3');
    expect(cellKey('LB3d')).toBe('why.cell.LB3');
    expect(cellKey('LB1c')).toBe('why.cell.LB1');
    expect(cellKey('LB3')).toBe('why.cell.LB3');
  });

  it('leaves other and missing types unnamed', () => {
    for (const t of ['GNG015', 'LC4a', 'DNp01x', 'LB2a', '', null]) expect(cellKey(t), String(t)).toBeNull();
  });
});
