import { toHex, utf8Bytes } from "./format.js";

/** Passphrase → hex key of N bits (SHA-256 truncated). */
export async function deriveKeyHex(passphrase, bits) {
  const data = utf8Bytes(passphrase);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest).slice(0, bits / 8);
  return toHex(bytes);
}
