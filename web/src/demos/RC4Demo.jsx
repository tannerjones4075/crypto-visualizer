import { useEffect, useState } from "react";
import { decryptRC4, encryptRC4 } from "../lib/ciphers.js";
import { deriveKeyHex } from "../lib/deriveKey.js";
import { PLAINTEXT_MAX } from "../lib/format.js";

const DEFAULT_PASS = "classroom";
const KEY_BITS = 128;

export default function RC4Demo({
  plaintext,
  setPlaintext,
  onRealWorldChange,
  rwEncryptStdout,
  onAdvancedMeta,
}) {
  const [passphrase, setPassphrase] = useState(DEFAULT_PASS);
  const [keyHex, setKeyHex] = useState("");
  const [cipherB64, setCipherB64] = useState("");
  const [cipherHex, setCipherHex] = useState("");
  const [keystreamHex, setKeystreamHex] = useState("");
  const [plaintextHex, setPlaintextHex] = useState("");
  const [recovered, setRecovered] = useState("");
  const [wrongKeyTry, setWrongKeyTry] = useState("");
  const [error, setError] = useState("");
  const [selectedAction, setSelectedAction] = useState(null);
  const [showHex, setShowHex] = useState(false);

  const safe = plaintext.slice(0, PLAINTEXT_MAX);

  useEffect(() => {
    let cancelled = false;
    deriveKeyHex(passphrase, KEY_BITS).then((hex) => {
      if (!cancelled) setKeyHex(hex);
    });
    return () => {
      cancelled = true;
    };
  }, [passphrase]);

  useEffect(() => {
    onAdvancedMeta?.({ plaintext: safe, keyHex, passphrase });
  }, [safe, keyHex, passphrase, onAdvancedMeta]);

  useEffect(() => {
    const escaped = safe.replace(/'/g, `'\\''`);
    const passEscaped = passphrase.replace(/'/g, `'\\''`);
    const encCmd = `printf '${escaped}' | openssl enc -rc4 -provider default -provider legacy -nosalt -k '${passEscaped}' -e -a`;
    const rwCipher = (rwEncryptStdout || "").trim();
    const decryptInput = rwCipher || "<run-encrypt-stdout-here>";
    const commands = [
      {
        id: "rc4-encrypt",
        title: "RC4 encrypt (OpenSSL)",
        caption:
          "Broken / obsolete. OpenSSL 3 needs the legacy provider. -k is the passphrase in plain text (OpenSSL derives the key).",
        commandText: encCmd,
        runBody: {
          part: "rc4",
          direction: "encrypt",
          plaintext: safe,
          passphrase,
        },
        applications: [
          "WEP Wi-Fi — RC4 with short IVs (see case study below)",
          "Historically used in TLS (RC4 suites) — now banned",
          "Legacy protocols only — do not use for new systems",
        ],
      },
      {
        id: "rc4-decrypt",
        title: "RC4 decrypt (OpenSSL)",
        caption: rwCipher
          ? "-k is the passphrase in plain text (not hex). Uses stdout from Real-world encrypt above."
          : "-k is the passphrase in plain text (not hex). Run encrypt above first — decrypt needs that Base64 ciphertext.",
        commandText: `printf '${decryptInput.replace(/'/g, `'\\''`)}' | openssl enc -rc4 -provider default -provider legacy -nosalt -k '${passEscaped}' -d -a`,
        runBody: rwCipher
          ? {
              part: "rc4",
              direction: "decrypt",
              plaintext: safe,
              passphrase,
              inputB64: rwCipher,
            }
          : null,
        applications: [
          "Same stream cipher run again with the shared key",
          "Never reuse the same keystream for two messages",
        ],
      },
    ];
    onRealWorldChange?.(commands);
  }, [safe, passphrase, rwEncryptStdout, onRealWorldChange]);

  function onEncrypt() {
    setSelectedAction("encrypt");
    setError("");
    try {
      const out = encryptRC4(safe, keyHex);
      setCipherB64(out.b64);
      setCipherHex(out.hex);
      setKeystreamHex(out.keystreamHex);
      setPlaintextHex(out.plaintextHex);
      setRecovered("");
      setWrongKeyTry("");
    } catch (err) {
      setError(err.message);
    }
  }

  function onDecrypt() {
    setSelectedAction("decrypt");
    setError("");
    if (!cipherB64) {
      setError("Encrypt first.");
      return;
    }
    try {
      const out = decryptRC4(cipherB64, keyHex);
      setRecovered(out.text);
      setWrongKeyTry("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function onDecryptWrong() {
    setSelectedAction("decrypt-wrong");
    setError("");
    if (!cipherB64) {
      setError("Encrypt first.");
      return;
    }
    try {
      const wrongHex = await deriveKeyHex(passphrase + "-wrong", KEY_BITS);
      const out = decryptRC4(cipherB64, wrongHex);
      setWrongKeyTry(out.text);
      setRecovered("");
    } catch (err) {
      setError(err.message);
    }
  }

  function onReset() {
    setSelectedAction("reset");
    setCipherB64("");
    setCipherHex("");
    setKeystreamHex("");
    setPlaintextHex("");
    setRecovered("");
    setWrongKeyTry("");
    setError("");
    setPassphrase(DEFAULT_PASS);
    setPlaintext("HELLO WORLD");
  }

  return (
    <div className="rc4-demo">
      <p className="banner-broken">Broken / obsolete — educational only. Do not use RC4 in real systems.</p>

      <label className="field">
        <span>Plaintext (max {PLAINTEXT_MAX})</span>
        <input
          type="text"
          value={safe}
          maxLength={PLAINTEXT_MAX}
          onChange={(e) => setPlaintext(e.target.value.slice(0, PLAINTEXT_MAX))}
        />
      </label>

      <section className="tdes-key-section" aria-labelledby="rc4-key-heading">
        <div className="tdes-key-header">
          <h3 id="rc4-key-heading">Key</h3>
          <button
            type="button"
            className={showHex ? "tdes-mode-btn selected" : "tdes-mode-btn"}
            onClick={() => setShowHex((v) => !v)}
            aria-pressed={showHex}
          >
            {showHex ? "Hide hex" : "Show in hex"}
          </button>
        </div>
        <label className="field">
          <span>Passphrase → {KEY_BITS}-bit key</span>
          <input
            type="text"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
          {showHex ? <code className="tdes-key-hex">{keyHex || "…"}</code> : null}
        </label>
        <p className="caption">
          Type the passphrase as text. We derive a {KEY_BITS}-bit key behind the scenes for the
          browser demo.
        </p>
        <div className="key-bar compact" role="img" aria-label={`${KEY_BITS}-bit key`}>
          <div className="tick" style={{ width: "50%" }}>
            <span>{KEY_BITS} bits used</span>
          </div>
        </div>
      </section>

      <div className="demo-actions">
        <button
          type="button"
          className={selectedAction === "encrypt" ? "action-selected" : ""}
          onClick={onEncrypt}
          disabled={!keyHex}
        >
          Encrypt
        </button>
        <button
          type="button"
          className={selectedAction === "decrypt" ? "action-selected" : ""}
          onClick={onDecrypt}
          disabled={!cipherB64}
        >
          Decrypt
        </button>
        <button
          type="button"
          className={selectedAction === "decrypt-wrong" ? "action-selected" : ""}
          onClick={onDecryptWrong}
          disabled={!cipherB64}
        >
          Decrypt with wrong key
        </button>
        <button type="button" className="danger" onClick={onReset}>
          Reset
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}

      <div className="stream-visual" aria-label="RC4 stream cipher steps">
        <div className="stream-step">
          <h4>Key</h4>
          <pre className="output tiny">{keyHex ? `${KEY_BITS}-bit from passphrase` : "…"}</pre>
        </div>
        <span className="stream-arrow" aria-hidden="true">
          →
        </span>
        <div className="stream-step">
          <h4>Keystream (XOR)</h4>
          <pre className="output tiny">{keystreamHex ? "secret byte stream" : "(encrypt to see)"}</pre>
        </div>
        <span className="stream-arrow" aria-hidden="true">
          →
        </span>
        <div className="stream-step">
          <h4>Mix plaintext</h4>
          <pre className="output tiny">{plaintextHex ? safe || "(empty)" : "(encrypt to see)"}</pre>
        </div>
        <span className="stream-arrow" aria-hidden="true">
          →
        </span>
        <div className="stream-step">
          <h4>Ciphertext</h4>
          <pre className="output tiny">{cipherB64 ? "unreadable without the key" : "(encrypt to see)"}</pre>
        </div>
      </div>
      <p className="caption">
        This cipher uses substitution and transposition ideas internally as a byte stream. One shared
        secret key encrypts and decrypts.
      </p>

      {cipherB64 ? (
        <div className="cipher-out">
          <h3>Ciphertext output</h3>
          <p className="caption">
            Base64 is not part of encryption — it only packages ciphertext bytes as printable text
            for transport (for example so binary data and awkward empty spaces can travel safely as
            characters). Anyone can unwrap Base64; the RC4 bytes underneath still need the key.
          </p>
          <p className="caption">
            Tools often print keys and ciphertext in hex too — that is only a readable spelling of raw
            bytes, not extra security.
          </p>
          <pre className="output">{cipherB64}</pre>
        </div>
      ) : null}

      {recovered !== "" ? (
        <div className="recover">
          <h4>Decrypt (correct key)</h4>
          <pre className="output">{recovered}</pre>
        </div>
      ) : null}

      {wrongKeyTry !== "" ? (
        <div className="recover recover-wrong">
          <h4>Decrypt (wrong key) — garbage</h4>
          <pre className="output">{wrongKeyTry}</pre>
          <p className="caption">That is the Confidentiality lesson: wrong key → useless data.</p>
        </div>
      ) : null}
    </div>
  );
}
