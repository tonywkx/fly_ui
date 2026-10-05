/** US-layout characters of the physical keys our hotkeys use. */
const BY_CODE: Record<string, string> = {
  BracketLeft: '[',
  BracketRight: ']',
  Comma: ',',
  Period: '.',
  Space: ' ',
};

/**
 * The hotkey a press means, lowercase for letters: `e.key` on latin layouts
 * (AZERTY keeps its letters), the physical key otherwise (Russian «м» → "v").
 */
export function hotkey(e: KeyboardEvent): string {
  const { key, code } = e;
  if (key.length !== 1 || key.charCodeAt(0) < 128) return key.length === 1 ? key.toLowerCase() : key;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  return BY_CODE[code] ?? key;
}
