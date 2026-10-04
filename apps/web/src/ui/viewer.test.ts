import { describe, expect, it } from 'vitest';
import { scenarioHref } from './viewer';

describe('scenarioHref', () => {
  it('switches the scenario and keeps only view settings', () => {
    const href = scenarioHref(
      '?scenario=escape&quality=low&gl=webgl2&stats=1&t=40&select=10001&x=abc',
      'song',
    );
    expect(new URLSearchParams(href).toString()).toBe('scenario=song&quality=low&gl=webgl2&stats=1');
  });

  it('works from an empty query', () => {
    expect(scenarioHref('', 'sugar')).toBe('?scenario=sugar');
  });
});
