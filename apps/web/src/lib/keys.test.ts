import { describe, expect, it } from 'vitest';
import { hotkey } from './keys';

const ev = (key: string, code: string) => ({ key, code }) as KeyboardEvent;

describe('hotkey', () => {
  it('keeps latin keys as typed (AZERTY stays AZERTY)', () => {
    expect(hotkey(ev('v', 'KeyV'))).toBe('v');
    expect(hotkey(ev('a', 'KeyQ'))).toBe('a');
    expect(hotkey(ev('Escape', 'Escape'))).toBe('Escape');
    expect(hotkey(ev(' ', 'Space'))).toBe(' ');
  });

  it('reads a non-latin layout by the physical key', () => {
    expect(hotkey(ev('м', 'KeyV'))).toBe('v');
    expect(hotkey(ev('М', 'KeyV'))).toBe('v');
    expect(hotkey(ev('х', 'BracketLeft'))).toBe('[');
    expect(hotkey(ev('ъ', 'BracketRight'))).toBe(']');
    expect(hotkey(ev('б', 'Comma'))).toBe(',');
    expect(hotkey(ev('ю', 'Period'))).toBe('.');
    expect(hotkey(ev('л', 'KeyK'))).toBe('k');
  });

  it('leaves an unmapped non-latin key alone', () => {
    expect(hotkey(ev('ё', 'Backquote'))).toBe('ё');
  });
});
