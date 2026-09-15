/** Teaching-scale modular Diffie–Hellman. Not for production. */
export const DH_TOY = {
  p: 2147483647n, // 2^31 - 1
  g: 5n,
  label: "Example prime (2^31−1)",
};

function modPow(base, exp, mod) {
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  let r = 1n;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return r;
}

export function randomSecret() {
  const max = Number(DH_TOY.p - 3n);
  const n = 2n + BigInt(Math.floor(Math.random() * max));
  return n;
}

export function publicFromSecret(secret) {
  return modPow(DH_TOY.g, secret, DH_TOY.p);
}

export function sharedSecret(localSecret, remotePublic) {
  return modPow(remotePublic, localSecret, DH_TOY.p);
}

export function bigintToHex(n) {
  return n.toString(16);
}
