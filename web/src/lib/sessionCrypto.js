import { fromHex, toB64, fromB64, utf8Bytes, utf8FromBytes, toHex } from "./format.js";

export async function generateRsaOaepPair() {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

function derToPem(der, label) {
  const b64 = toB64(new Uint8Array(der));
  const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----\n`;
}

/** Export Bob’s RSA public key as PEM (SPKI). */
export async function exportRsaPublicPem(publicKey) {
  const der = await crypto.subtle.exportKey("spki", publicKey);
  return derToPem(der, "PUBLIC KEY");
}

/** Export Bob’s RSA private key as PEM (PKCS#8). Teaching demos only. */
export async function exportRsaPrivatePem(privateKey) {
  const der = await crypto.subtle.exportKey("pkcs8", privateKey);
  return derToPem(der, "PRIVATE KEY");
}

export async function rsaEncryptPublic(publicKey, plaintext) {
  const buf = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, utf8Bytes(plaintext));
  return toB64(new Uint8Array(buf));
}

export async function rsaDecryptPrivate(privateKey, ciphertextB64) {
  const buf = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    fromB64(ciphertextB64)
  );
  return utf8FromBytes(new Uint8Array(buf));
}

export async function generateEcdsaPair() {
  return crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
}

export async function ecdsaSign(privateKey, plaintext) {
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    utf8Bytes(plaintext)
  );
  return toB64(new Uint8Array(sig));
}

export async function ecdsaVerify(publicKey, plaintext, signatureB64) {
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    fromB64(signatureB64),
    utf8Bytes(plaintext)
  );
}

async function aesKeyFromHex(keyHex) {
  const raw = fromHex(keyHex.slice(0, 64).padEnd(64, "0"));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function deriveSessionKeyHex(sharedSecretHex) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    utf8Bytes("cv-session:" + sharedSecretHex)
  );
  return toHex(new Uint8Array(digest));
}

export async function sealMessage({ keyHex, plaintext, stripTag = false }) {
  const key = await aesKeyFromHex(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, utf8Bytes(plaintext))
  );
  const body = ct.slice(0, ct.length - 16);
  const tag = stripTag ? new Uint8Array(16) : ct.slice(ct.length - 16);
  return {
    ivB64: toB64(iv),
    ciphertextB64: toB64(body),
    tagB64: toB64(tag),
    ok: true,
  };
}

export async function openMessage({
  keyHex,
  ivB64,
  ciphertextB64,
  tagB64,
  wrongKey = false,
}) {
  try {
    const hex = wrongKey ? keyHex.replace(/.$/, (c) => (c === "0" ? "1" : "0")) : keyHex;
    const key = await aesKeyFromHex(hex);
    const iv = fromB64(ivB64);
    const body = fromB64(ciphertextB64);
    const tag = fromB64(tagB64);
    const packed = new Uint8Array(body.length + tag.length);
    packed.set(body, 0);
    packed.set(tag, body.length);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, packed);
    return { plaintext: utf8FromBytes(new Uint8Array(pt)), ok: true, failReason: null };
  } catch {
    return {
      plaintext: "",
      ok: false,
      failReason: wrongKey ? "key" : "integrity",
    };
  }
}

export async function macMessage({ keyHex, plaintext }) {
  const raw = fromHex(keyHex.slice(0, 64).padEnd(64, "0"));
  const key = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, utf8Bytes(plaintext));
  return toHex(new Uint8Array(sig));
}

/** HMAC-SHA-256 with a typed shared secret (UTF-8). Matches openssl dgst -sha256 -hmac. */
export async function hmacSha256Hex({ keyText, plaintext }) {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8Bytes(keyText),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, utf8Bytes(plaintext));
  return toHex(new Uint8Array(sig));
}
