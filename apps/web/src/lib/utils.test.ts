import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('keeps a size token beside a colour', () => {
    expect(cn('text-caption text-bone', 'text-ash')).toBe('text-caption text-ash');
  });

  it('a later size token still wins over an earlier one', () => {
    expect(cn('text-caption', 'text-label')).toBe('text-label');
  });
});
