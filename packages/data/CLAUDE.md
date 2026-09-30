# packages/data
- Single source of truth for every file in apps/web/public/data: zod manifest schema + encoder (Node) + decoder (browser/Worker).
- Any format change = bump FORMAT_VERSION + update schema, encoder, decoder, and roundtrip test in the same commit.
- Little-endian, 4-byte aligned sections, typed-array views without copies. Coordinates quantized to Uint16 inside the manifest bbox.
- No Node APIs in decoders (they run in the browser).
