import { fromB64, fromHex, toB64, toHex, utf8Bytes, utf8FromBytes } from "./format.js";
import CryptoJS from "crypto-js";

export async function sha256Hex(s) {
  const digest = await crypto.subtle.digest("SHA-256", utf8Bytes(s));
  return toHex(new Uint8Array(digest));
}

/** MD5 hex digest (teaching only — broken for integrity). Web Crypto has no MD5. */
export function md5Hex(s) {
  return md5Bytes(utf8Bytes(s));
}

function md5Bytes(bytes) {
  // RFC 1321 — compact teaching implementation, not for production.
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);

  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
    20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
    10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];

  const bitLen = bytes.length * 8;
  const withOne = bytes.length + 1;
  const paddedLen = ((withOne + 7) >> 6 << 6) + 56; // bytes to length field
  const total = paddedLen + 8;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 8, bitLen >>> 0, true);
  view.setUint32(total - 4, Math.floor(bitLen / 0x100000000), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const rotl = (x, n) => (x << n) | (x >>> (32 - n));

  for (let offset = 0; offset < total; offset += 64) {
    const M = new Uint32Array(16);
    for (let i = 0; i < 16; i++) M[i] = view.getUint32(offset + i * 4, true);

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F;
      let g;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl(F, S[i])) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);
  return toHex(out);
}

/**
 * Toy cipher: Caesar +13 on A–Z / a–z, then reverse every 4-character chunk.
 * Labeled as ideas inside many ciphers — not a real algorithm.
 */
export function toyEncrypt(s) {
  const sub = [...s]
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + 13) % 26) + 65);
      if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + 13) % 26) + 97);
      return ch;
    })
    .join("");

  const padded = sub.padEnd(Math.ceil(Math.max(sub.length, 1) / 4) * 4, " ");
  let out = "";
  for (let i = 0; i < padded.length; i += 4) {
    out += [...padded.slice(i, i + 4)].reverse().join("");
  }
  return out.trimEnd();
}

export function encodeBase64(s) {
  return toB64(utf8Bytes(s));
}

export function decodeBase64(b64) {
  return utf8FromBytes(fromB64(b64));
}

/** Classic RC4 (teaching only — broken / obsolete). */
function rc4Xor(keyBytes, data) {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + keyBytes[i % keyBytes.length]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
  }
  let i = 0;
  j = 0;
  const out = new Uint8Array(data.length);
  const keystream = new Uint8Array(Math.min(data.length, 16));
  for (let n = 0; n < data.length; n++) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
    const k = s[(s[i] + s[j]) & 255];
    if (n < keystream.length) keystream[n] = k;
    out[n] = data[n] ^ k;
  }
  return { out, keystream };
}

export function encryptRC4(plaintext, keyHex) {
  const keyBytes = fromHex(keyHex);
  const data = utf8Bytes(plaintext);
  const { out, keystream } = rc4Xor(keyBytes, data);
  return {
    raw: out,
    hex: toHex(out),
    b64: toB64(out),
    keystreamHex: toHex(keystream),
    plaintextHex: toHex(data),
  };
}

export function decryptRC4(ciphertextB64, keyHex) {
  const keyBytes = fromHex(keyHex);
  const data = fromB64(ciphertextB64.trim());
  const { out, keystream } = rc4Xor(keyBytes, data);
  return {
    raw: out,
    text: utf8FromBytes(out),
    hex: toHex(out),
    keystreamHex: toHex(keystream),
  };
}

const DES_IV_HEX = "0000000000000000";
export const DES_BLOCK_BYTES = 8;

/** PKCS7 length in bytes (always at least one full pad block when already aligned). */
export function pkcs7PaddedLen(plainLen, blockBytes = DES_BLOCK_BYTES) {
  return (Math.floor(plainLen / blockBytes) + 1) * blockBytes;
}

/** DES-CBC PKCS7, zero IV (teaching only — broken / obsolete). */
export function encryptDES(plaintext, keyHex) {
  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.enc.Hex.parse(DES_IV_HEX);
  const encrypted = CryptoJS.DES.encrypt(plaintext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const b64 = encrypted.toString();
  const raw = fromB64(b64);
  const plainLen = utf8Bytes(plaintext).length;
  const paddedTo = pkcs7PaddedLen(plainLen);
  return {
    raw,
    hex: toHex(raw),
    b64,
    ivHex: DES_IV_HEX,
    plainBytes: plainLen,
    paddedBytes: paddedTo,
  };
}

export function decryptDES(ciphertextB64, keyHex) {
  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.enc.Hex.parse(DES_IV_HEX);
  const decrypted = CryptoJS.DES.decrypt(
    { ciphertext: CryptoJS.enc.Base64.parse(ciphertextB64.trim()) },
    key,
    { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 },
  );
  const text = decrypted.toString(CryptoJS.enc.Utf8);
  return { text, hex: decrypted.toString(CryptoJS.enc.Hex) };
}

const DES_KEY_HEX_LEN = 16; // 64 bits drawn per DES key

/** Build 192-bit 3DES key hex: 3-key = K1||K2||K3; 2-key = K1||K2||K1. */
export function assembleTDESKeyHex(k1, k2, k3, keyCount) {
  const a = (k1 || "").replace(/\s+/g, "").toLowerCase();
  const b = (k2 || "").replace(/\s+/g, "").toLowerCase();
  const c = (k3 || "").replace(/\s+/g, "").toLowerCase();
  if (a.length !== DES_KEY_HEX_LEN || b.length !== DES_KEY_HEX_LEN) {
    throw new Error("Each key needs 16 hex characters (64 bits drawn).");
  }
  if (!/^[0-9a-f]+$/.test(a + b)) {
    throw new Error("Keys must be hex.");
  }
  if (keyCount === 2) {
    return a + b + a;
  }
  if (c.length !== DES_KEY_HEX_LEN || !/^[0-9a-f]+$/.test(c)) {
    throw new Error("K3 needs 16 hex characters.");
  }
  return a + b + c;
}

/** 3DES-CBC PKCS7, zero IV (teaching only — legacy / deprecated). */
export function encryptTDES(plaintext, keyHex192) {
  const key = CryptoJS.enc.Hex.parse(keyHex192);
  const iv = CryptoJS.enc.Hex.parse(DES_IV_HEX);
  const encrypted = CryptoJS.TripleDES.encrypt(plaintext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const b64 = encrypted.toString();
  const raw = fromB64(b64);
  const plainLen = utf8Bytes(plaintext).length;
  const paddedTo = pkcs7PaddedLen(plainLen);
  return {
    raw,
    hex: toHex(raw),
    b64,
    ivHex: DES_IV_HEX,
    plainBytes: plainLen,
    paddedBytes: paddedTo,
  };
}

export function decryptTDES(ciphertextB64, keyHex192) {
  const key = CryptoJS.enc.Hex.parse(keyHex192);
  const iv = CryptoJS.enc.Hex.parse(DES_IV_HEX);
  const decrypted = CryptoJS.TripleDES.decrypt(
    { ciphertext: CryptoJS.enc.Base64.parse(ciphertextB64.trim()) },
    key,
    { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 },
  );
  const text = decrypted.toString(CryptoJS.enc.Utf8);
  return { text, hex: decrypted.toString(CryptoJS.enc.Hex) };
}

export const AES_BLOCK_BYTES = 16;
/** 128-bit IV, all zeros — teaching only; never reuse a fixed IV with a real key. */
export const AES_IV_HEX = "00000000000000000000000000000000";

const AES_ROUNDS = { 128: 10, 192: 12, 256: 14 };

export function aesRoundsForKeyBits(keyBits) {
  return AES_ROUNDS[keyBits] ?? 10;
}

async function importAesKey(keyHex) {
  const raw = fromHex(keyHex);
  return crypto.subtle.importKey("raw", raw, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]);
}

/** AES-CBC with PKCS7 (Web Crypto default), zero IV. keyHex length must match 128/192/256. */
export async function encryptAES(plaintext, keyHex) {
  const key = await importAesKey(keyHex);
  const iv = fromHex(AES_IV_HEX);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv },
    key,
    utf8Bytes(plaintext),
  );
  const raw = new Uint8Array(cipherBuf);
  const plainLen = utf8Bytes(plaintext).length;
  const paddedTo = pkcs7PaddedLen(plainLen, AES_BLOCK_BYTES);
  return {
    raw,
    hex: toHex(raw),
    b64: toB64(raw),
    ivHex: AES_IV_HEX,
    plainBytes: plainLen,
    paddedBytes: paddedTo,
  };
}

export async function decryptAES(ciphertextB64, keyHex) {
  const key = await importAesKey(keyHex);
  const iv = fromHex(AES_IV_HEX);
  const cipherBytes = fromB64(ciphertextB64.trim());
  try {
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv },
      key,
      cipherBytes,
    );
    const plain = new Uint8Array(plainBuf);
    return { text: utf8FromBytes(plain), hex: toHex(plain) };
  } catch {
    // Wrong key / bad padding — Web Crypto throws; surface as teaching garbage.
    return { text: "", hex: "", failed: true };
  }
}


