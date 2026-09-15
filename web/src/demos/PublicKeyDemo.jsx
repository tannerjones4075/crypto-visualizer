import { useCallback, useEffect, useState } from "react";
import {
  DH_TOY,
  bigintToHex,
  publicFromSecret,
  randomSecret,
  sharedSecret,
} from "../lib/dh.js";
import {
  deriveSessionKeyHex,
  ecdsaSign,
  ecdsaVerify,
  generateEcdsaPair,
  macMessage,
  openMessage,
  sealMessage,
} from "../lib/sessionCrypto.js";
import { PLAINTEXT_MAX } from "../lib/format.js";
import { StageHero } from "../components/StageVisuals.jsx";

const SUITES = [
  {
    id: "dh-rsa",
    label: "DH + RSA",
    detail:
      "The main difference between suites is which asymmetric technology establishes and authenticates the session key. The overall purpose is the same.",
    steps: [
      "DH → Alice and Bob establish a shared secret.",
      "RSA → Authenticate / sign the DH exchange (and optionally wrap a tiny AES key).",
      "AES → Uses the resulting shared secret as a symmetric session key to encrypt the actual data.",
    ],
    roles: [
      { part: "DH", job: "key agreement" },
      { part: "RSA", job: "authentication / signature" },
      { part: "AES", job: "data encryption" },
    ],
    pros: [
      "Familiar modular DH story (gᵃ mod p)",
      "RSA auth / wrap is widely understood and supported",
    ],
    cons: [
      "Larger key sizes (e.g. 2048-bit RSA)",
      "Generally heavier than elliptic-curve paths",
    ],
  },
  {
    id: "dh-ecc",
    label: "ECDH + ECDSA",
    detail:
      "ECC is a family of algorithms — this suite means ECDH for agreement and ECDSA for signatures, not “DH + ECC” as a vague label.",
    steps: [
      "ECDH → Establishes the shared secret (elliptic-curve Diffie–Hellman).",
      "ECDSA → Authenticates the parties / signs the exchange.",
      "AES → Encrypts the actual data with the session key.",
    ],
    roles: [
      { part: "ECDH", job: "key agreement" },
      { part: "ECDSA", job: "authentication / signature" },
      { part: "AES", job: "data encryption" },
    ],
    pros: [
      "Much smaller keys for similar strength",
      "Generally more efficient (CPU / bandwidth)",
    ],
    cons: [
      "Curve choice matters — use a trusted curve",
      "Some legacy gear still lacks solid ECDH / ECDSA",
    ],
  },
];

const KX_COMPARE_ROWS = [
  { aspect: "Key agreement", rsa: "DH", ecc: "ECDH" },
  { aspect: "Authentication", rsa: "RSA signatures", ecc: "ECDSA (ECC signatures)" },
  { aspect: "Data encryption", rsa: "AES", ecc: "AES" },
  { aspect: "Security goal", rsa: "Same", ecc: "Same" },
  { aspect: "Key sizes", rsa: "Larger", ecc: "Much smaller" },
  { aspect: "Performance", rsa: "Generally heavier", ecc: "Generally more efficient" },
];

const KEY_EXCHANGE_STEPS = [
  {
    id: 1,
    title: "Pick secrets",
    body: "Alice and Bob each pick a secret number. Those secrets never leave their machines.",
  },
  {
    id: 2,
    title: "Make public values",
    body: "From the secret, each makes a public value (using shared math parameters).",
  },
  {
    id: 3,
    title: "Exchange publics",
    body: "They send only the public values to each other — safe if someone is listening.",
  },
  {
    id: 4,
    title: "Same shared secret",
    body: "Each combines their own secret with the other’s public value and gets the same shared secret.",
  },
  {
    id: 5,
    title: "Session key for AES",
    body: "Turn that shared secret into a session key; AES uses it to encrypt messages (6.4).",
  },
];

const MUTUAL_AUTH_STEPS = [
  {
    id: 1,
    title: "Key pairs ready",
    body: "Alice and Bob each hold a private key (secret) and a public key (shareable).",
  },
  {
    id: 2,
    title: "Alice proves herself",
    body: "Alice signs the handshake data with her private key and sends the signature to Bob.",
  },
  {
    id: 3,
    title: "Bob verifies Alice",
    body: "Bob checks the signature with Alice’s public key. Fail → impostor or tamper — stop.",
  },
  {
    id: 4,
    title: "Bob proves himself",
    body: "Bob signs; Alice verifies with Bob’s public key. Now authentication is mutual.",
  },
  {
    id: 5,
    title: "Safe to continue",
    body: "Only then do they run key exchange (6.3). A shared secret with a stranger is unsafe.",
  },
];

const ONGOING_STEPS = [
  {
    id: 1,
    title: "Session key ready",
    body: "The Diffie–Hellman shared secret from 6.3 became a symmetric session key. AES will encrypt the actual data with that key.",
  },
  {
    id: 2,
    title: "Encrypt (Confidentiality)",
    body: "Alice seals the message under the session key. Eavesdroppers see ciphertext, not plaintext — that is Confidentiality.",
  },
  {
    id: 3,
    title: "HMAC / AEAD tag",
    body: "An HMAC (Hash-based Message Authentication Code) — or an AEAD tag — binds this message to the session. Tampering or a stripped tag fails integrity / message-by-message auth. This demo shows an HMAC over the plaintext with the session key.",
  },
  {
    id: 4,
    title: "Bob opens OK",
    body: "Bob checks the tag and opens with the same session key. Happy path: Confidentiality + integrity for this message.",
  },
  {
    id: 5,
    title: "MITM if 6.2 skipped",
    body: "Without mutual authentication, Diffie–Hellman can still produce a key — but with Eve in the middle. Encryption then gives Confidentiality to the wrong peer. Mutual auth (6.2) stops that before you trust the session.",
  },
];

const SIGNATURE_STEPS = [
  {
    id: 1,
    title: "Message ready",
    body: "The message stays readable. Signatures prove origin and integrity — they are not Confidentiality.",
  },
  {
    id: 2,
    title: "Fingerprint",
    body: "Hash the message (SHA-256). You sign the fingerprint, not the whole blob.",
  },
  {
    id: 3,
    title: "Sign",
    body: "The sender’s private key produces a signature over that fingerprint. (public encrypt / private decrypt).",
  },
  {
    id: 4,
    title: "Verify",
    body: "Anyone with the public key checks the signature. Valid → fingerprint matches and the private key holder acted.",
  },
  {
    id: 5,
    title: "Tamper",
    body: "Change one letter of the message. The fingerprint changes; verification fails. That is Integrity (+ authenticity of the key holder).",
  },
];

function freshDh() {
  const aliceSecret = randomSecret();
  const bobSecret = randomSecret();
  const alicePublic = publicFromSecret(aliceSecret);
  const bobPublic = publicFromSecret(bobSecret);
  const aliceShared = sharedSecret(aliceSecret, bobPublic);
  const bobShared = sharedSecret(bobSecret, alicePublic);
  return {
    aliceSecret,
    bobSecret,
    alicePublic,
    bobPublic,
    aliceSharedHex: bigintToHex(aliceShared),
    bobSharedHex: bigintToHex(bobShared),
  };
}

/** Flip first character so students see a one-letter tamper. */
function tamperOneChar(text) {
  if (!text) return "!";
  const first = text[0];
  const flipped = first === "A" ? "B" : first === "a" ? "b" : first.toUpperCase() === first ? first.toLowerCase() : first.toUpperCase();
  // If case flip is a no-op (digits/symbols), replace with "X" / "Y".
  const next = flipped === first ? (first === "X" ? "Y" : "X") : flipped;
  return next + text.slice(1);
}

export default function PublicKeyDemo({
  subId,
  plaintext,
  setPlaintext,
  onRealWorldChange,
  rwResults,
  onKxMethodChange,
}) {
  const [suite, setSuite] = useState("dh-rsa");
  const [dh, setDh] = useState(() => freshDh());
  const [sessionKeyHex, setSessionKeyHex] = useState("");
  const [stripTag, setStripTag] = useState(false);
  const [wrongKey, setWrongKey] = useState(false);
  const [macHex, setMacHex] = useState("");
  const [seal, setSeal] = useState(null);
  const [openResult, setOpenResult] = useState(null);
  const [ciaEcho, setCiaEcho] = useState("");
  const [ecdsaPair, setEcdsaPair] = useState(null);
  const [signatureB64, setSignatureB64] = useState("");
  const [signedPlaintext, setSignedPlaintext] = useState("");
  const [verifyOk, setVerifyOk] = useState(null);
  const [tamperOk, setTamperOk] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [authStep, setAuthStep] = useState(1);
  const [kxStep, setKxStep] = useState(1);
  const [ongoingStep, setOngoingStep] = useState(1);
  const [sigStep, setSigStep] = useState(1);
  const [kxMethod, setKxMethod] = useState("dh-rsa"); // "dh-rsa" | "dh-ecc"
  const [showAliceSecret, setShowAliceSecret] = useState(false);
  const [showBobSecret, setShowBobSecret] = useState(false);

  const safe = plaintext.slice(0, PLAINTEXT_MAX);
  const activeAuth = MUTUAL_AUTH_STEPS.find((s) => s.id === authStep) ?? MUTUAL_AUTH_STEPS[0];
  const activeKx = KEY_EXCHANGE_STEPS.find((s) => s.id === kxStep) ?? KEY_EXCHANGE_STEPS[0];
  const activeOngoing =
    ONGOING_STEPS.find((s) => s.id === ongoingStep) ?? ONGOING_STEPS[0];
  const activeSig = SIGNATURE_STEPS.find((s) => s.id === sigStep) ?? SIGNATURE_STEPS[0];

  useEffect(() => {
    let cancelled = false;
    generateEcdsaPair().then((pair) => {
      if (!cancelled) setEcdsaPair(pair);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onKxMethodChange?.(kxMethod);
  }, [kxMethod, onKxMethodChange]);

  useEffect(() => {
    let cancelled = false;
    deriveSessionKeyHex(dh.aliceSharedHex).then((hex) => {
      if (!cancelled) setSessionKeyHex(hex);
    });
    return () => {
      cancelled = true;
    };
  }, [dh.aliceSharedHex]);

  useEffect(() => {
    if (subId === "negotiation") {
      onRealWorldChange?.([
        {
          id: "pk-suite",
          title: "Show cipher suite (local OpenSSL)",
          caption: "Local only — does not open a network TLS session.",
          commandText: "openssl ciphers -v 'ECDHE-RSA-AES128-GCM-SHA256'",
          runBody: { part: "handshake", variant: "cipher-suite", plaintext: "suite" },
        },
      ]);
    } else if (subId === "key-exchange") {
      const alicePem =
        rwResults?.find((r) => r.id === "pk-dh-alice" && !r.error)?.stdout?.trim() ?? "";
      const bobPem =
        rwResults?.find((r) => r.id === "pk-dh-bob" && !r.error)?.stdout?.trim() ?? "";
      const bobPub =
        rwResults?.find((r) => r.id === "pk-dh-bob-pub" && !r.error)?.stdout?.trim() ?? "";
      const kdfInput = `cv-session:${dh.aliceSharedHex}`;
      const escapedKdf = kdfInput.replace(/'/g, `'\\''`);
      onRealWorldChange?.([
        {
          id: "pk-dh-alice",
          title: "1. Alice’s DH private key",
          caption: "Generate Alice’s DH key from shared parameters. Run prints the PEM (same as writing alice.pem).",
          commandText: "openssl genpkey -paramfile dh.pem -out alice.pem",
          runBody: { part: "handshake", variant: "dh-gen-alice", plaintext: "dh" },
        },
        {
          id: "pk-dh-bob",
          title: "2. Bob’s DH private key",
          caption: "Generate Bob’s DH key from the same parameters. Run prints the PEM (same as writing bob.pem).",
          commandText: "openssl genpkey -paramfile dh.pem -out bob.pem",
          runBody: { part: "handshake", variant: "dh-gen-bob", plaintext: "dh" },
        },
        {
          id: "pk-dh-bob-pub",
          title: "3. Bob’s public value",
          caption: bobPem
            ? "Extract Bob’s public key to send to Alice. Uses the PEM from step 2."
            : "Run step 2 first — this needs Bob’s private key PEM.",
          commandText: "openssl pkey -in bob.pem -pubout -out bob.pub",
          runBody: {
            part: "handshake",
            variant: "dh-bob-pub",
            plaintext: "dh",
            privatePem: bobPem,
          },
        },
        {
          id: "pk-dh-derive",
          title: "4. Shared secret (derive)",
          caption:
            alicePem && bobPub
              ? "Alice mixes her private key with Bob’s public key. Run prints the shared secret as hex (binary under the hood)."
              : "Run steps 1 and 3 first — needs Alice’s private PEM and Bob’s public PEM.",
          commandText:
            "openssl pkeyutl -derive -inkey alice.pem -peerkey bob.pub -out shared.bin",
          runBody: {
            part: "handshake",
            variant: "dh-derive",
            plaintext: "dh",
            privatePem: alicePem,
            publicPem: bobPub,
          },
        },
        {
          id: "pk-session-key",
          title: "5. Turn shared secret into a session key",
          caption:
            kxMethod === "dh-ecc"
              ? "Classroom KDF matching the ECDH demo (not OpenSSL’s shared.bin from step 4): SHA-256 of cv-session: + this page’s shared-secret hex."
              : "Classroom KDF matching the Diffie–Hellman demo (not OpenSSL’s shared.bin from step 4): SHA-256 of cv-session: + this page’s shared-secret hex.",
          commandText: `printf '${escapedKdf}' | openssl dgst -sha256`,
          runBody: { part: "foundations", variant: "sha256", plaintext: kdfInput },
        },
      ]);
    } else if (subId === "mutual-auth") {
      onRealWorldChange?.([
        {
          id: "pk-ec-private-auth",
          title: "Generate EC private key (P-256)",
          caption:
            "Each side needs a key pair before mutual auth. Private key stays secret; Run prints a fresh PEM.",
          commandText:
            "openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out private.pem",
          runBody: { part: "sign", variant: "ec-gen-private", plaintext: "ec" },
        },
        {
          id: "pk-ec-public-auth",
          title: "Derive EC public key",
          caption:
            "Public key is computed from the private key and can be shared. Run generates a fresh private key, then prints the public PEM.",
          commandText: "openssl pkey -in private.pem -pubout -out public.pem",
          runBody: { part: "sign", variant: "ec-show-public", plaintext: "ec" },
        },
        {
          id: "pk-rsa-private-auth",
          title: "Generate RSA private key (2048-bit)",
          caption: "Classic RSA key pair — common in TLS / auth stories. Teaching demo only.",
          commandText: "openssl genrsa -out private.pem 2048",
          runBody: { part: "sign", variant: "rsa-gen-private", plaintext: "rsa" },
        },
        {
          id: "pk-rsa-public-auth",
          title: "Derive RSA public key",
          caption:
            "Extract the public half. Run generates a fresh private key, then prints the public PEM.",
          commandText: "openssl rsa -in private.pem -pubout -out public.pem",
          runBody: { part: "sign", variant: "rsa-show-public", plaintext: "rsa" },
        },
        {
          id: "pk-suite-auth",
          title: "Cipher suite (auth algorithms named here)",
          caption: "Suite line that names signature algorithms — deep dive on signing is 6.5.",
          commandText: "openssl ciphers -v 'ECDHE-RSA-AES128-GCM-SHA256'",
          runBody: { part: "handshake", variant: "cipher-suite", plaintext: "suite" },
        },
      ]);
    } else if (subId === "ongoing") {
      onRealWorldChange?.([
        {
          id: "pk-suite-ongoing",
          title: "Cipher suite (AES + AEAD named here)",
          caption:
            "Local reminder of a suite that pairs key exchange with AES-GCM. Bulk encrypt / HMAC is the browser demo above — not a second OpenSSL record layer.",
          commandText: "openssl ciphers -v 'ECDHE-RSA-AES128-GCM-SHA256'",
          runBody: { part: "handshake", variant: "cipher-suite", plaintext: "suite" },
        },
      ]);
    } else if (subId === "signatures") {
      const escaped = safe.replace(/'/g, `'\\''`);
      onRealWorldChange?.([
        {
          id: "pk-fingerprint",
          title: "Fingerprint to show",
          caption:
            "Hash-then-sign starts here: digest the message. Change one letter → new fingerprint. Same idea as Part 1.",
          commandText: `printf '${escaped}' | openssl dgst -sha256`,
          runBody: { part: "foundations", variant: "sha256", plaintext: safe },
        },
        {
          id: "pk-ec-private",
          title: "Generate EC private key (P-256)",
          caption:
            "Matches this page’s browser ECDSA demo. Private key stays secret; Run prints a fresh PEM each time.",
          commandText:
            "openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out private.pem",
          runBody: { part: "sign", variant: "ec-gen-private", plaintext: "ec" },
        },
        {
          id: "pk-ec-public",
          title: "Derive EC public key",
          caption:
            "Public key is computed from the private key and is safe to share. Run generates a fresh private key in the container, then prints the public PEM.",
          commandText: "openssl pkey -in private.pem -pubout -out public.pem",
          runBody: { part: "sign", variant: "ec-show-public", plaintext: "ec" },
        },
        {
          id: "pk-rsa-private",
          title: "Generate RSA private key (2048-bit)",
          caption:
            "Classic RSA key pair used in many TLS / auth stories (6.2 / 6.3). Teaching demo only.",
          commandText: "openssl genrsa -out private.pem 2048",
          runBody: { part: "sign", variant: "rsa-gen-private", plaintext: "rsa" },
        },
        {
          id: "pk-rsa-public",
          title: "Derive RSA public key",
          caption:
            "Extract the public half from an RSA private key. Run generates a fresh private key, then prints the public PEM.",
          commandText: "openssl rsa -in private.pem -pubout -out public.pem",
          runBody: { part: "sign", variant: "rsa-show-public", plaintext: "rsa" },
        },
      ]);
    } else {
      onRealWorldChange?.([]);
    }
  }, [onRealWorldChange, subId, kxMethod, safe, dh.aliceSharedHex, rwResults]);

  const runKeyExchange = useCallback(() => {
    setDh(freshDh());
    setShowAliceSecret(false);
    setShowBobSecret(false);
    setSeal(null);
    setOpenResult(null);
    setMacHex("");
    setCiaEcho("");
    setError("");
  }, []);

  async function sendMessage() {
    if (!sessionKeyHex) return;
    setBusy(true);
    setError("");
    setCiaEcho("");
    try {
      const sealed = await sealMessage({
        keyHex: sessionKeyHex,
        plaintext: safe,
        stripTag,
      });
      setSeal(sealed);
      const mac = await macMessage({ keyHex: sessionKeyHex, plaintext: safe });
      setMacHex(mac);
      const opened = await openMessage({
        keyHex: sessionKeyHex,
        ivB64: sealed.ivB64,
        ciphertextB64: sealed.ciphertextB64,
        tagB64: sealed.tagB64,
        wrongKey,
      });
      setOpenResult(opened);
      if (!opened.ok) {
        setCiaEcho(
          opened.failReason === "key"
            ? "Confidentiality: failed (wrong session key)"
            : "Integrity / message authentication: failed (bad or missing tag)"
        );
      } else {
        setCiaEcho("Confidentiality + message-by-message authentication + integrity: OK");
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function signMessage() {
    if (!ecdsaPair) return;
    setBusy(true);
    setError("");
    try {
      const sig = await ecdsaSign(ecdsaPair.privateKey, safe);
      setSignatureB64(sig);
      setSignedPlaintext(safe);
      const ok = await ecdsaVerify(ecdsaPair.publicKey, safe, sig);
      setVerifyOk(ok);
      const tamperedText = tamperOneChar(safe);
      const tampered = await ecdsaVerify(ecdsaPair.publicKey, tamperedText, sig);
      setTamperOk(tampered);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  const tamperedMessage = tamperOneChar(signedPlaintext);

  return (
    <div className="hs-demo">
      {subId !== "signatures" ? (
        <div className="hs-parties">
          <div className="hs-party">
            <p className="hs-party-role">Supplicant</p>
            <p className="hs-party-name">Alice</p>
          </div>
          <div className="hs-party hs-party-bob">
            <p className="hs-party-role">Verifier</p>
            <p className="hs-party-name">Bob</p>
          </div>
        </div>
      ) : null}

      {subId === "negotiation" ? (
        <section className="hs-panel">
          <StageHero subId="negotiation" />
          <h3>Negotiation</h3>
          <p className="caption">
            Alice and Bob agree a <strong>cipher suite</strong>. Compare <strong>DH + RSA</strong>{" "}
            vs <strong>ECDH + ECDSA</strong> — same goal, different public-key family. Tap a suite.
          </p>
          <div className="hs-suite-chips" role="group" aria-label="Cipher suite">
            {SUITES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={suite === s.id ? "active" : ""}
                onClick={() => {
                  setSuite(s.id);
                  setKxMethod(s.id);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="hs-suite-cards">
            {SUITES.map((s) => (
              <article
                key={s.id}
                className={`hs-suite-card ${suite === s.id ? "active" : ""}`}
              >
                <h4>{s.label}</h4>
                <p>{s.detail}</p>
                <p className="caption hs-kx-typically">Typically:</p>
                <ol className="hs-kx-role-steps">
                  {s.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <ul className="hs-kx-role-legend caption">
                  {s.roles.map((r) => (
                    <li key={r.part}>
                      <strong>{r.part}</strong> = {r.job}
                    </li>
                  ))}
                </ul>
                <div className="pros-cons hs-suite-pros-cons">
                  <div className="pros">
                    <h5>Pros</h5>
                    <ul>
                      {s.pros.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="cons">
                    <h5>Cons</h5>
                    <ul>
                      {s.cons.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {subId === "mutual-auth" ? (
        <section className="hs-panel">
          <StageHero subId="mutual-auth" />
          <h3>Mutual authentication</h3>
          <p className="caption">
            <strong>Electronic signatures</strong> prove “I hold this private key” without sending
            the private key. Step through the handshake checks:
          </p>
          <ol className="hs-auth-steps">
            {MUTUAL_AUTH_STEPS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={authStep === s.id ? "active" : ""}
                  onClick={() => setAuthStep(s.id)}
                >
                  <span className="hs-auth-step-num">{s.id}</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
          <div className="hs-auth-detail">
            <p>{activeAuth.body}</p>
          </div>
          <div className="hs-auth-cartoon" aria-hidden="true">
            <div className={authStep >= 2 ? "lit" : ""}>
              <span>Alice</span>
              <code>private → sign</code>
              <span>→ Bob</span>
            </div>
            <div className={authStep >= 3 ? "lit" : ""}>
              <span>Bob</span>
              <code>Alice’s public → verify</code>
              <span>{authStep >= 3 ? "OK" : "…"}</span>
            </div>
            <div className={authStep >= 4 ? "lit" : ""}>
              <span>Bob</span>
              <code>private → sign</code>
              <span>→ Alice</span>
            </div>
            <div className={authStep >= 5 ? "lit" : ""}>
              <span>Alice</span>
              <code>Bob’s public → verify</code>
              <span>{authStep >= 5 ? "OK — mutual" : "…"}</span>
            </div>
          </div>
          <div className="demo-actions">
            <button
              type="button"
              disabled={authStep <= 1}
              onClick={() => setAuthStep((n) => Math.max(1, n - 1))}
            >
              Previous step
            </button>
            <button
              type="button"
              disabled={authStep >= MUTUAL_AUTH_STEPS.length}
              onClick={() => setAuthStep((n) => Math.min(MUTUAL_AUTH_STEPS.length, n + 1))}
            >
              Next step
            </button>
            <button
              type="button"
              disabled={authStep === 1}
              onClick={() => setAuthStep(1)}
            >
              Reset
            </button>
          </div>
          <p className="caption">
            Contrast: encrypting with a public key hides a secret (6.3). Signing with a private key
            proves who acted (details in <strong>6.5</strong>).
          </p>
        </section>
      ) : null}

      {subId === "key-exchange" ? (
        <section className="hs-panel">
          <StageHero subId="key-exchange" />
          <h3>Key exchange</h3>
          <p className="caption">
            The main difference is the asymmetric technology used to establish and authenticate the
            session key. The overall purpose is basically the same. Compare{" "}
            <strong>DH + RSA</strong> with <strong>ECDH + ECDSA</strong> — not “DH + ECC,” because DH
            itself has an elliptic-curve version (ECDH).
          </p>
          <div className="hs-kx-tabs" role="tablist" aria-label="Key exchange method">
            <button
              type="button"
              role="tab"
              aria-selected={kxMethod === "dh-rsa"}
              className={kxMethod === "dh-rsa" ? "active" : ""}
              onClick={() => {
                setKxMethod("dh-rsa");
                setSuite("dh-rsa");
              }}
            >
              DH + RSA
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kxMethod === "dh-ecc"}
              className={kxMethod === "dh-ecc" ? "active" : ""}
              onClick={() => {
                setKxMethod("dh-ecc");
                setSuite("dh-ecc");
              }}
            >
              ECDH + ECDSA
            </button>
          </div>

          {(() => {
            const activeSuite = SUITES.find((s) => s.id === kxMethod) ?? SUITES[0];
            return (
              <article className="hs-suite-card active hs-kx-suite-summary">
                <h4>{activeSuite.label}</h4>
                <p>{activeSuite.detail}</p>
                <p className="caption hs-kx-typically">Typically:</p>
                <ol className="hs-kx-role-steps">
                  {activeSuite.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <ul className="hs-kx-role-legend caption">
                  {activeSuite.roles.map((r) => (
                    <li key={r.part}>
                      <strong>{r.part}</strong> = {r.job}
                    </li>
                  ))}
                </ul>
                <div className="pros-cons hs-suite-pros-cons">
                  <div className="pros">
                    <h5>Pros</h5>
                    <ul>
                      {activeSuite.pros.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="cons">
                    <h5>Cons</h5>
                    <ul>
                      {activeSuite.cons.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            );
          })()}

          <div role="tabpanel">
            <p className="caption">
              {kxMethod === "dh-ecc" ? (
                <>
                  Demo below uses <strong>ECDH</strong> notation (points on a curve).{" "}
                  <strong>ECDSA</strong> is the signature half of this suite (see 6.2 / 6.5). Curve
                  math is in Advanced.
                </>
              ) : (
                <>
                  Demo below is classic <strong>Diffie–Hellman</strong>. <strong>RSA</strong>{" "}
                  authenticates the exchange (6.2) and can optionally wrap a tiny AES key (band
                  below). Agree a shared secret without sending that secret on the wire.
                </>
              )}
            </p>
            {kxMethod === "dh-rsa" ? (
              <aside className="hs-mod-def" aria-label="What is mod">
                <h4>What is mod?</h4>
                <ul className="caption hs-bullets">
                  <li>
                    <strong>mod</strong> = remainder after division (numbers wrap like a clock).
                  </li>
                  <li>
                    Example: <code>17 mod 5 = 2</code> because 17 = 3×5 + 2.
                  </li>
                  <li>
                    In <code>gᵃ mod p</code>: raise g to power a, divide by prime p, keep the
                    remainder. That public value is safe to send.
                  </li>
                </ul>
              </aside>
            ) : null}
            <ol className="hs-auth-steps">
              {KEY_EXCHANGE_STEPS.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={kxStep === s.id ? "active" : ""}
                    onClick={() => setKxStep(s.id)}
                  >
                    <span className="hs-auth-step-num">{s.id}</span>
                    {s.title}
                  </button>
                </li>
              ))}
            </ol>
            <div className="hs-auth-detail">
              <p>
                {kxMethod === "dh-ecc" && kxStep === 2
                  ? "Each multiplies the base point P by their secret: public points A = a·P and B = b·P. Those points can travel in the clear."
                  : kxMethod === "dh-ecc" && kxStep === 4
                    ? "Alice computes K = a·B; Bob computes K = b·A. Same shared secret. ECDH does not encrypt the message itself."
                    : activeKx.body}
              </p>
            </div>
            <div className="hs-auth-cartoon hs-kx-cartoon">
              <div
                className={kxStep >= 1 ? "lit" : ""}
                title="Each side picks a private secret (a or b). Secrets never leave the machine."
              >
                <span>Alice</span>
                <code>secret a</code>
                <span>Bob</span>
                <code>secret b</code>
              </div>
              <div
                className={kxStep >= 2 ? "lit" : ""}
                title={
                  kxMethod === "dh-ecc"
                    ? "From the secret, make a public point (A = a·P, B = b·P). Safe to show others."
                    : "From the secret, make a public value (A = gᵃ mod p, B = gᵇ mod p). Safe to show others."
                }
              >
                <span>Alice</span>
                <code>{kxMethod === "dh-ecc" ? "A = a·P" : "A = gᵃ mod p"}</code>
                <span>Bob</span>
                <code>{kxMethod === "dh-ecc" ? "B = b·P" : "B = gᵇ mod p"}</code>
              </div>
              <div
                className={kxStep >= 3 ? "lit" : ""}
                title="They exchange only public values. An eavesdropper can see A and B — not a or b."
              >
                <span>Alice → Bob</span>
                <code>send A (public)</code>
                <span>Bob → Alice</span>
                <code>send B (public)</code>
              </div>
              <div
                className={kxStep >= 4 ? "lit" : ""}
                title={
                  kxMethod === "dh-ecc"
                    ? "Alice: K = a·B. Bob: K = b·A. Same shared secret K. DH/ECDH does not encrypt the message."
                    : "Alice: K = Bᵃ. Bob: K = Aᵇ. Same shared secret K. Diffie–Hellman does not encrypt the message."
                }
              >
                <span>Alice</span>
                <code>{kxMethod === "dh-ecc" ? "K = a·B" : "K = Bᵃ"}</code>
                <span>Bob</span>
                <code>{kxMethod === "dh-ecc" ? "K = b·A" : "K = Aᵇ"}</code>
                <span>{kxStep >= 4 ? "same K" : "…"}</span>
              </div>
              <div
                className={kxStep >= 5 ? "lit" : ""}
                title="Turn that shared secret into a session key; AES uses it to encrypt messages (6.4)."
              >
                <span>Both</span>
                <code>session key ← K</code>
                <span>{kxStep >= 5 ? "ready for AES (6.4)" : "…"}</span>
              </div>
            </div>
            <div className="demo-actions">
              <button
                type="button"
                disabled={kxStep <= 1}
                onClick={() => setKxStep((n) => Math.max(1, n - 1))}
              >
                Previous step
              </button>
              <button
                type="button"
                disabled={kxStep >= KEY_EXCHANGE_STEPS.length}
                onClick={() => setKxStep((n) => Math.min(KEY_EXCHANGE_STEPS.length, n + 1))}
              >
                Next step
              </button>
              <button
                type="button"
                disabled={kxStep === 1}
                onClick={() => setKxStep(1)}
              >
                Reset
              </button>
              <button type="button" onClick={runKeyExchange}>
                {kxMethod === "dh-ecc" ? "Run ECDH demo again" : "Run Diffie–Hellman again"}
              </button>
            </div>

            <div className="hs-dh-grid revealed">
              <div>
                <h4>Alice</h4>
                <p className="hs-secret-row">
                  Secret:{" "}
                  <code className="hs-break">
                    {showAliceSecret ? bigintToHex(dh.aliceSecret) : "••••••••"}
                  </code>{" "}
                  <button
                    type="button"
                    className="hs-secret-toggle"
                    onClick={() => setShowAliceSecret((v) => !v)}
                  >
                    {showAliceSecret ? "Hide secret" : "Show secret"}
                  </button>
                </p>
                <p>
                  Public: <code className="hs-break">{bigintToHex(dh.alicePublic)}</code>
                </p>
                <p>
                  Shared: <code className="hs-break">{dh.aliceSharedHex}</code>
                </p>
              </div>
              <div>
                <h4>Bob</h4>
                <p className="hs-secret-row">
                  Secret:{" "}
                  <code className="hs-break">
                    {showBobSecret ? bigintToHex(dh.bobSecret) : "••••••••"}
                  </code>{" "}
                  <button
                    type="button"
                    className="hs-secret-toggle"
                    onClick={() => setShowBobSecret((v) => !v)}
                  >
                    {showBobSecret ? "Hide secret" : "Show secret"}
                  </button>
                </p>
                <p>
                  Public: <code className="hs-break">{bigintToHex(dh.bobPublic)}</code>
                </p>
                <p>
                  Shared: <code className="hs-break">{dh.bobSharedHex}</code>
                </p>
              </div>
            </div>
            <div
              className={`hs-kx-result ${dh.aliceSharedHex === dh.bobSharedHex ? "ok" : "fail"}`}
            >
              <div className="hs-kx-result-row">
                <span className="hs-kx-result-label">Shared secret</span>
                <span className="hs-kx-result-value">
                  {dh.aliceSharedHex === dh.bobSharedHex
                    ? "Match — Alice and Bob computed the same value"
                    : "No match"}
                </span>
              </div>
              {sessionKeyHex ? (
                <div className="hs-kx-result-row">
                  <span className="hs-kx-result-label">Session key</span>
                  <code className="hs-break hs-kx-result-key">{sessionKeyHex}</code>
                </div>
              ) : null}
              <p className="hs-kx-result-note">
                AES (6.4) will encrypt real messages with this session key — not with the raw
                Diffie–Hellman shared secret.
              </p>
            </div>

            <div className="hs-kx-compare" role="region" aria-label="DH + RSA vs ECDH + ECDSA">
              <h4>The big difference</h4>
              <table className="hs-kx-compare-table">
                <thead>
                  <tr>
                    <th scope="col"></th>
                    <th scope="col">DH + RSA</th>
                    <th scope="col">ECDH + ECDSA</th>
                  </tr>
                </thead>
                <tbody>
                  {KX_COMPARE_ROWS.map((row) => (
                    <tr key={row.aspect}>
                      <th scope="row">{row.aspect}</th>
                      <td>{row.rsa}</td>
                      <td>{row.ecc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="hs-kx-takeaway">
                <strong>Takeaway:</strong> RSA and ECC are alternative public-key technologies.
                DH/ECDH establishes a shared secret, while RSA/ECDSA can authenticate that exchange.
                AES then efficiently encrypts the actual data.
              </p>
            </div>

            {kxMethod === "dh-ecc" ? (
              <p className="caption">
                ECDH + ECDSA path: agreement uses ECDH; signatures use ECDSA (smaller keys).
                Point-addition deep dive: Advanced → elliptic curves.
              </p>
            ) : (
              <p className="caption">
              </p>
            )}
          </div>
        </section>
      ) : null}

      {subId === "ongoing" ? (
        <section className="hs-panel hs-msg">
          <StageHero subId="ongoing" />
          <h3>Ongoing messages</h3>
          <ul className="caption hs-bullets">
            <li>Uses the session key from Diffie–Hellman (6.3).</li>
            <li>
              Step through Confidentiality, HMAC tags, then what goes wrong if mutual auth
              (6.2) was skipped.
            </li>
            <li>HMAC = session peer; signatures = key holder (6.5).</li>
          </ul>
          <ol className="hs-auth-steps">
            {ONGOING_STEPS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={ongoingStep === s.id ? "active" : ""}
                  onClick={() => setOngoingStep(s.id)}
                >
                  <span className="hs-auth-step-num">{s.id}</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
          <div className="hs-auth-detail">
            <p>{activeOngoing.body}</p>
          </div>
          <div className="hs-auth-cartoon" aria-hidden="true">
            <div className={ongoingStep >= 2 ? "lit" : ""}>
              <span>Alice</span>
              <code>AES(session key)</code>
              <span>→ ciphertext</span>
            </div>
            <div className={ongoingStep >= 3 ? "lit" : ""}>
              <span>+ tag</span>
              <code>HMAC / AEAD</code>
              <span>auth + integrity</span>
            </div>
            <div className={ongoingStep >= 4 ? "lit" : ""}>
              <span>Bob</span>
              <code>verify tag → open</code>
              <span>{ongoingStep >= 4 ? "OK" : "…"}</span>
            </div>
            <div
              className={`hs-mitm ${ongoingStep >= 5 ? "lit" : ""}`}
            >
              <span>Alice</span>
              <code>↔ Eve ↔</code>
              <span>Bob</span>
              <span>{ongoingStep >= 5 ? "MITM — wrong peer" : "…"}</span>
            </div>
          </div>
          <div className="demo-actions">
            <button
              type="button"
              disabled={ongoingStep <= 1}
              onClick={() => setOngoingStep((n) => Math.max(1, n - 1))}
            >
              Previous step
            </button>
            <button
              type="button"
              disabled={ongoingStep >= ONGOING_STEPS.length}
              onClick={() => setOngoingStep((n) => Math.min(ONGOING_STEPS.length, n + 1))}
            >
              Next step
            </button>
            <button
              type="button"
              disabled={ongoingStep === 1}
              onClick={() => setOngoingStep(1)}
            >
              Reset
            </button>
          </div>
          <label className="field">
            <span>Message (Alice → Bob)</span>
            <input
              value={safe}
              maxLength={PLAINTEXT_MAX}
              onChange={(e) => setPlaintext(e.target.value.slice(0, PLAINTEXT_MAX))}
            />
          </label>
          <div className="hs-toggles">
            <label>
              <input
                type="checkbox"
                checked={stripTag}
                onChange={(e) => setStripTag(e.target.checked)}
              />
              Strip auth tag
            </label>
            <label>
              <input
                type="checkbox"
                checked={wrongKey}
                onChange={(e) => setWrongKey(e.target.checked)}
              />
              Wrong key
            </label>
          </div>
          <div className="demo-actions">
            <button type="button" disabled={busy || !sessionKeyHex} onClick={sendMessage}>
              {busy ? "Sending…" : "Send message"}
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
          {ciaEcho ? <p className="hs-cia-echo">{ciaEcho}</p> : null}
          {macHex ? (
            <p className="caption">
              HMAC: <code className="hs-break">{macHex.slice(0, 48)}…</code>
            </p>
          ) : null}
          {seal ? (
            <p className="caption">
              Ciphertext: <code className="hs-break">{seal.ciphertextB64.slice(0, 40)}…</code>
              <br />
              Tag: <code className="hs-break">{seal.tagB64}</code>
            </p>
          ) : null}
          {openResult ? (
            <p className="caption">
              Bob opens:{" "}
              {openResult.ok ? (
                <code>{openResult.plaintext}</code>
              ) : (
                <span className="error">failed ({openResult.failReason})</span>
              )}
            </p>
          ) : null}
        </section>
      ) : null}

      {subId === "signatures" ? (
        <section className="hs-panel">
          <StageHero
            subId="signatures"
            signed={Boolean(signatureB64)}
            verifyOk={verifyOk}
            tamperOk={tamperOk}
          />
          <h3>Digital signatures</h3>
          <p className="caption">
            Hash-then-sign over a SHA-256 fingerprint. Opposite of RSA lock in
            6.3. Step through, then sign and compare verify vs a one-character change.
          </p>
          <ol className="hs-auth-steps">
            {SIGNATURE_STEPS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={sigStep === s.id ? "active" : ""}
                  onClick={() => setSigStep(s.id)}
                >
                  <span className="hs-auth-step-num">{s.id}</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
          <div className="hs-auth-detail">
            <p>{activeSig.body}</p>
          </div>

          <figure className="hs-sig-diagram">
            <figcaption>Happy path — prove who signed</figcaption>
            <div className="hs-sig-flow" aria-hidden="true">
              <div className={`hs-sig-node ${sigStep >= 1 ? "active" : ""}`}>
                <span className="hs-sig-who">Message</span>
                <div className="hs-sig-box">still readable</div>
                <span className="hs-sig-hint">not Confidentiality</span>
              </div>
              <div className={`hs-sig-arrow ${sigStep >= 2 ? "active" : ""}`}>
                <span>SHA-256</span>
                <div className="hs-sig-arrow-line" />
              </div>
              <div className={`hs-sig-node ${sigStep >= 2 ? "active" : ""}`}>
                <span className="hs-sig-who">Fingerprint</span>
                <div className="hs-sig-box print">short digest</div>
              </div>
              <div className={`hs-sig-arrow ${sigStep >= 3 ? "active" : ""}`}>
                <span>private key</span>
                <div className="hs-sig-arrow-line" />
              </div>
              <div className={`hs-sig-node ${sigStep >= 3 ? "active" : ""}`}>
                <span className="hs-sig-who">Signature</span>
                <div className="hs-sig-box seal">seal</div>
              </div>
              <div className={`hs-sig-arrow ${sigStep >= 4 ? "active" : ""}`}>
                <span>public key</span>
                <div className="hs-sig-arrow-line" />
              </div>
              <div className={`hs-sig-node ${sigStep >= 4 ? "active" : ""}`}>
                <span className="hs-sig-who">Anyone checks</span>
                <div className={`hs-sig-box ${sigStep >= 4 ? "ok" : ""}`}>
                  {sigStep >= 4 ? "valid ✓" : "valid?"}
                </div>
              </div>
            </div>
          </figure>

          <figure className={`hs-sig-diagram ${sigStep >= 5 ? "show-tamper" : ""}`}>
            <figcaption>Tamper check — change one letter</figcaption>
            <div className="hs-sig-flow hs-sig-tamper-flow" aria-hidden="true">
              <div className={`hs-sig-node ${sigStep >= 5 ? "active" : ""}`}>
                <span className="hs-sig-who">Same seal</span>
                <div className="hs-sig-box seal">old signature</div>
              </div>
              <div className={`hs-sig-arrow ${sigStep >= 5 ? "active warn" : ""}`}>
                <span>vs</span>
                <div className="hs-sig-arrow-line" />
              </div>
              <div className={`hs-sig-node ${sigStep >= 5 ? "active" : ""}`}>
                <span className="hs-sig-who">Edited message</span>
                <div className="hs-sig-box warn">one letter changed</div>
              </div>
              <div className={`hs-sig-arrow ${sigStep >= 5 ? "active warn" : ""}`}>
                <span>verify</span>
                <div className="hs-sig-arrow-line" />
              </div>
              <div className={`hs-sig-node ${sigStep >= 5 ? "active fail" : ""}`}>
                <span className="hs-sig-who">Result</span>
                <div className={`hs-sig-box ${sigStep >= 5 ? "fail" : ""}`}>
                  {sigStep >= 5 ? "invalid ✗" : "…"}
                </div>
              </div>
            </div>
            <p className="hs-sig-diagram-note">
              Fingerprint no longer matches the seal → Integrity fails (message was changed).
            </p>
          </figure>

          <div className="demo-actions">
            <button
              type="button"
              disabled={sigStep <= 1}
              onClick={() => setSigStep((n) => Math.max(1, n - 1))}
            >
              Previous step
            </button>
            <button
              type="button"
              disabled={sigStep >= SIGNATURE_STEPS.length}
              onClick={() => setSigStep((n) => Math.min(SIGNATURE_STEPS.length, n + 1))}
            >
              Next step
            </button>
            <button
              type="button"
              disabled={sigStep === 1}
              onClick={() => setSigStep(1)}
            >
              Reset
            </button>
          </div>
          <label className="field">
            <span>Message to sign</span>
            <input
              value={safe}
              maxLength={PLAINTEXT_MAX}
              onChange={(e) => setPlaintext(e.target.value.slice(0, PLAINTEXT_MAX))}
            />
          </label>
          <div className="demo-actions">
            <button type="button" disabled={busy || !ecdsaPair} onClick={signMessage}>
              {busy ? "Signing…" : "Sign message"}
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}

          {signatureB64 ? (
            <>
              <div className="hs-sig-section">
                <h3 className="hs-subhead">Verify</h3>
                <p className="caption">
                  Same message + same signature + public key → check should pass.
                </p>
                <p className="caption">
                  Message: <code>{signedPlaintext || "(empty)"}</code>
                  <br />
                  Signature: <code className="hs-break">{signatureB64.slice(0, 48)}…</code>
                  <br />
                  Result:{" "}
                  <strong className={verifyOk ? "hs-sig-ok" : "hs-sig-fail"}>
                    {verifyOk ? "valid — signatures match" : "invalid"}
                  </strong>
                </p>
              </div>

              <div className="hs-sig-section hs-sig-tamper">
                <h3 className="hs-subhead">One character change</h3>
                <p className="caption">
                  Keep the original signature, change one letter of the message. Fingerprints
                  diverge → verify fails.
                </p>
                <p className="caption">
                  Original: <code>{signedPlaintext || "(empty)"}</code>
                  <br />
                  Tampered: <code>{tamperedMessage}</code>
                  <br />
                  Same signature: <code className="hs-break">{signatureB64.slice(0, 48)}…</code>
                  <br />
                  Result:{" "}
                  <strong className={tamperOk ? "hs-sig-ok" : "hs-sig-fail"}>
                    {tamperOk
                      ? "valid (unexpected)"
                      : "invalid — signatures do not match"}
                  </strong>
                </p>
              </div>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
