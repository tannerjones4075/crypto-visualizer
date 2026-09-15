/** AES MixColumns helpers for the teaching lab (not a full AES engine). */

export const DEFAULT_STATE = [
  [0x00, 0x11, 0x22, 0x33],
  [0x44, 0x55, 0x66, 0x77],
  [0x88, 0x99, 0xaa, 0xbb],
  [0xcc, 0xdd, 0xee, 0xff],
];

/** AES GF(2^8) multiply. */
export function gmul(a, b) {
  let aa = a & 0xff;
  let bb = b & 0xff;
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (bb & 1) p ^= aa;
    const hi = aa & 0x80;
    aa = (aa << 1) & 0xff;
    if (hi) aa ^= 0x1b;
    bb >>= 1;
  }
  return p & 0xff;
}

/**
 * Mix one AES column (top→bottom bytes).
 * Matrix rows: [02 03 01 01], [01 02 03 01], [01 01 02 03], [03 01 01 02]
 */
export function mixColumn(col) {
  const [s0, s1, s2, s3] = col;
  return [
    gmul(0x02, s0) ^ gmul(0x03, s1) ^ s2 ^ s3,
    s0 ^ gmul(0x02, s1) ^ gmul(0x03, s2) ^ s3,
    s0 ^ s1 ^ gmul(0x02, s2) ^ gmul(0x03, s3),
    gmul(0x03, s0) ^ s1 ^ s2 ^ gmul(0x02, s3),
  ].map((b) => b & 0xff);
}

export function cloneState(state) {
  return state.map((row) => row.slice());
}

export function columnBytes(state, col) {
  return [state[0][col], state[1][col], state[2][col], state[3][col]];
}

export function writeColumn(state, col, bytes) {
  const next = cloneState(state);
  for (let row = 0; row < 4; row++) {
    next[row][col] = bytes[row] & 0xff;
  }
  return next;
}

/**
 * Seed a 4×4 state from plaintext UTF-8 bytes.
 * Uses the first 16 bytes; pads with PKCS7-style pad length when short.
 * Empty plaintext → DEFAULT_STATE.
 */
export function seedStateFromText(text) {
  const bytes = new TextEncoder().encode(text ?? "");
  if (!bytes.length) return cloneState(DEFAULT_STATE);

  const out = new Uint8Array(16);
  const n = Math.min(16, bytes.length);
  out.set(bytes.subarray(0, n));
  if (n < 16) {
    const pad = 16 - n;
    out.fill(pad, n);
  }

  const state = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  // AES state is filled column-major: byte i → row i%4, col floor(i/4)
  for (let i = 0; i < 16; i++) {
    state[i % 4][Math.floor(i / 4)] = out[i];
  }
  return state;
}

export function hexByte(b) {
  return (b & 0xff).toString(16).padStart(2, "0");
}
