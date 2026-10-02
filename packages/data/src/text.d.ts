// lib is ES2023 only (no DOM/Node types); these exist in browsers, Workers and Node.
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
declare class TextDecoder {
  decode(input?: ArrayBufferView | ArrayBuffer): string;
}
