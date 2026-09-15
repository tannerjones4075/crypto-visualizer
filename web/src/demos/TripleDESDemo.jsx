import { useEffect, useState } from "react";
import {
  DES_BLOCK_BYTES,
  assembleTDESKeyHex,
  decryptTDES,
  encryptTDES,
  pkcs7PaddedLen,
} from "../lib/ciphers.js";
import { deriveKeyHex } from "../lib/deriveKey.js";
import { PLAINTEXT_MAX, utf8Bytes } from "../lib/format.js";

const DEFAULT_PASS = "classroom";
const DEFAULT_K1 = "alpha";
const DEFAULT_K2 = "bravo";
const DEFAULT_K3 = "charlie";
const KEY_BITS = 64;

export default function TripleDESDemo({
  plaintext,
  setPlaintext,
  onRealWorldChange,
  onPipelineMeta,
  rwEncryptStdout,
}) {
  const [keyCount, setKeyCount] = useState(3); // 2 or 3
  const [k1Plain, setK1Plain] = useState(DEFAULT_K1);
  const [k2Plain, setK2Plain] = useState(DEFAULT_K2);
  const [k3Plain, setK3Plain] = useState(DEFAULT_K3);
  const [k1Hex, setK1Hex] = useState("");
  const [k2Hex, setK2Hex] = useState("");
  const [k3Hex, setK3Hex] = useState("");
  const [showHex, setShowHex] = useState(false);
  const [rwPassphrase, setRwPassphrase] = useState(DEFAULT_PASS);
  const [cipherB64, setCipherB64] = useState("");
  const [plainBytes, setPlainBytes] = useState(0);
  const [paddedBytes, setPaddedBytes] = useState(0);
  const [recovered, setRecovered] = useState("");
  const [wrongKeyTry, setWrongKeyTry] = useState("");
  const [error, setError] = useState("");
  const [selectedAction, setSelectedAction] = useState(null);

  const safe = plaintext.slice(0, PLAINTEXT_MAX);
  const effectiveBits = keyCount === 2 ? 112 : 168;
  const k3PlainEffective = keyCount === 2 ? k1Plain : k3Plain;
  const keysEqual = k1Plain === k2Plain && k2Plain === k3PlainEffective;
  const keysReady = Boolean(k1Hex && k2Hex && (keyCount === 2 || k3Hex));

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      deriveKeyHex(k1Plain, KEY_BITS),
      deriveKeyHex(k2Plain, KEY_BITS),
      deriveKeyHex(k3Plain, KEY_BITS),
    ]).then(([a, b, c]) => {
      if (cancelled) return;
      setK1Hex(a);
      setK2Hex(b);
      setK3Hex(c);
    });
    return () => {
      cancelled = true;
    };
  }, [k1Plain, k2Plain, k3Plain]);

  useEffect(() => {
    onPipelineMeta?.({
      plaintext: safe,
      k1Plain,
      k2Plain,
      k3Plain,
      keyCount,
      cipherB64,
      recovered,
    });
  }, [safe, k1Plain, k2Plain, k3Plain, keyCount, cipherB64, recovered, onPipelineMeta]);

  useEffect(() => {
    const escaped = safe.replace(/'/g, `'\\''`);
    const passEscaped = rwPassphrase.replace(/'/g, `'\\''`);
    const iv = "0000000000000000";
    const encCmd = `printf '${escaped}' | openssl enc -des-ede3-cbc -provider default -provider legacy -nosalt -k '${passEscaped}' -iv ${iv} -e -a`;
    const rwCipher = (rwEncryptStdout || "").trim();
    const decryptInput = rwCipher || "<run-encrypt-stdout-here>";
    onRealWorldChange?.([
      {
        id: "tdes-encrypt",
        title: "3DES encrypt (OpenSSL)",
        caption:
          "Legacy. OpenSSL uses -k passphrase here — not the demo K1/K2/K3 text. Mode: 3DES-EDE-CBC with a visible zero IV.",
        commandText: encCmd,
        runBody: {
          part: "tdes",
          direction: "encrypt",
          plaintext: safe,
          passphrase: rwPassphrase,
          ivHex: iv,
        },
        applications: [
          "Older payment and banking links",
          "Legacy VPN / enterprise protocols",
          "Kept for compatibility — prefer AES for new systems",
        ],
      },
      {
        id: "tdes-decrypt",
        title: "3DES decrypt (OpenSSL)",
        caption: rwCipher
          ? "-k is the Real-world passphrase. Uses stdout from encrypt above."
          : "-k is the Real-world passphrase. Run encrypt above first.",
        commandText: `printf '${decryptInput.replace(/'/g, `'\\''`)}' | openssl enc -des-ede3-cbc -provider default -provider legacy -nosalt -k '${passEscaped}' -iv ${iv} -d -a`,
        runBody: rwCipher
          ? {
              part: "tdes",
              direction: "decrypt",
              plaintext: safe,
              passphrase: rwPassphrase,
              ivHex: iv,
              inputB64: rwCipher,
            }
          : null,
        applications: [
          "Same passphrase unlocks the ciphertext in openssl",
          "Browser demo keys (K1/K2/K3) are a separate teaching path",
        ],
      },
    ]);
  }, [safe, rwPassphrase, rwEncryptStdout, onRealWorldChange]);

  function bundleKey() {
    return assembleTDESKeyHex(k1Hex, k2Hex, k3Hex, keyCount);
  }

  function onEncrypt() {
    setSelectedAction("encrypt");
    setError("");
    try {
      const out = encryptTDES(safe, bundleKey());
      setCipherB64(out.b64);
      setPlainBytes(out.plainBytes);
      setPaddedBytes(out.paddedBytes);
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
      const out = decryptTDES(cipherB64, bundleKey());
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
      const wrongK1 = await deriveKeyHex(`${k1Plain}-wrong`, KEY_BITS);
      const key = assembleTDESKeyHex(wrongK1, k2Hex, k3Hex, keyCount);
      const out = decryptTDES(cipherB64, key);
      setWrongKeyTry(out.text || out.hex || "(non-UTF-8 garbage)");
      setRecovered("");
    } catch (err) {
      setError(err.message);
    }
  }

  function onReset() {
    setSelectedAction(null);
    setCipherB64("");
    setPlainBytes(0);
    setPaddedBytes(0);
    setRecovered("");
    setWrongKeyTry("");
    setError("");
  }

  const padPreview = pkcs7PaddedLen(utf8Bytes(safe).length);
  const displayK3Hex = keyCount === 2 ? k1Hex : k3Hex;

  return (
    <div className="tdes-demo">
      <p className="banner-legacy">Legacy / deprecated — stretched DES’s life; prefer AES today.</p>

      <label className="field">
        <span>Plaintext (max {PLAINTEXT_MAX})</span>
        <input
          type="text"
          value={safe}
          maxLength={PLAINTEXT_MAX}
          onChange={(e) => setPlaintext(e.target.value.slice(0, PLAINTEXT_MAX))}
        />
      </label>

      <section className="tdes-key-section" aria-labelledby="tdes-key-heading">
        <div className="tdes-key-header">
          <h3 id="tdes-key-heading">Key</h3>
          <button
            type="button"
            className={showHex ? "tdes-mode-btn selected" : "tdes-mode-btn"}
            onClick={() => setShowHex((v) => !v)}
            aria-pressed={showHex}
          >
            {showHex ? "Hide hex" : "Show in hex"}
          </button>
        </div>

        <div className="tdes-key-mode" role="group" aria-label="2-key or 3-key">
          <button
            type="button"
            className={keyCount === 2 ? "tdes-mode-btn selected" : "tdes-mode-btn"}
            onClick={() => setKeyCount(2)}
          >
            2-key (112 bits)
          </button>
          <button
            type="button"
            className={keyCount === 3 ? "tdes-mode-btn selected" : "tdes-mode-btn"}
            onClick={() => setKeyCount(3)}
          >
            3-key (168 bits)
          </button>
        </div>

        <div className="tdes-key-bar" role="img" aria-label={`${effectiveBits}-bit effective key`}>
          <div
            className="tdes-key-fill"
            style={{ width: `${(effectiveBits / 168) * 100}%` }}
          >
            <span>{effectiveBits}-bit effective</span>
          </div>
        </div>

        <p className="caption">
          Type each key as text. We derive a 64-bit DES key schedule from each (same idea as Part 3).
          {keyCount === 2 ? " In 2-key mode, K3 = K1." : ""}
        </p>

        <div className="tdes-key-fields">
          <label className="field">
            <span>K1</span>
            <input
              type="text"
              value={k1Plain}
              onChange={(e) => setK1Plain(e.target.value)}
            />
            {showHex ? (
              <code className="tdes-key-hex">{k1Hex || "…"}</code>
            ) : null}
          </label>
          <label className="field">
            <span>K2</span>
            <input
              type="text"
              value={k2Plain}
              onChange={(e) => setK2Plain(e.target.value)}
            />
            {showHex ? (
              <code className="tdes-key-hex">{k2Hex || "…"}</code>
            ) : null}
          </label>
          {keyCount === 3 ? (
            <label className="field">
              <span>K3</span>
              <input
                type="text"
                value={k3Plain}
                onChange={(e) => setK3Plain(e.target.value)}
              />
              {showHex ? (
                <code className="tdes-key-hex">{k3Hex || "…"}</code>
              ) : null}
            </label>
          ) : (
            <div className="tdes-k3-note">
              <p className="caption">
                K3 = K1
                {showHex && k1Hex ? (
                  <>
                    {" "}
                    · <code className="tdes-key-hex inline">{displayK3Hex}</code>
                  </>
                ) : null}
              </p>
            </div>
          )}
        </div>

        <p className="caption">
          Different keys is the point of 3DES — change K1, K2
          {keyCount === 3 ? ", or K3" : ""} to see EDE use separate secrets.
          {keysEqual
            ? " Right now the keys match, so 3DES collapses toward single DES (why the middle step is Decrypt)."
            : ""}
        </p>
      </section>

      <label className="field">
        <span>Real-world passphrase (openssl -k only)</span>
        <input
          type="text"
          value={rwPassphrase}
          onChange={(e) => setRwPassphrase(e.target.value)}
        />
      </label>
      <p className="caption">
        This passphrase is for the Real-world strip below. It is not K1/K2/K3 in the browser demo.
      </p>

      <div className="demo-actions">
        <button
          type="button"
          className={selectedAction === "encrypt" ? "action-selected" : ""}
          onClick={onEncrypt}
          disabled={!keysReady}
        >
          Encrypt
        </button>
        <button
          type="button"
          className={selectedAction === "decrypt" ? "action-selected" : ""}
          onClick={onDecrypt}
          disabled={!cipherB64 || !keysReady}
        >
          Decrypt
        </button>
        <button
          type="button"
          className={selectedAction === "decrypt-wrong" ? "action-selected" : ""}
          onClick={onDecryptWrong}
          disabled={!cipherB64 || !keysReady}
        >
          Decrypt with wrong key
        </button>
        <button type="button" className="danger" onClick={onReset}>
          Reset
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}

      <p className="caption">
        “{safe || "(empty)"}” is {utf8Bytes(safe).length} byte
        {utf8Bytes(safe).length === 1 ? "" : "s"}; padding completes each {DES_BLOCK_BYTES}-byte
        block → {padPreview} bytes.
      </p>

      {cipherB64 ? (
        <div className="cipher-out">
          <h3>Ciphertext output</h3>
          <p className="caption">
            “{safe}” was {plainBytes} bytes; padding completed each {DES_BLOCK_BYTES}-byte block →{" "}
            {paddedBytes} bytes. Base64 is not part of encryption — it only packages ciphertext bytes
            as printable text for transport (for example so binary data and awkward empty spaces can
            travel safely as characters).
          </p>
          <pre className="output">{cipherB64}</pre>
        </div>
      ) : null}

      {recovered !== "" ? (
        <div className="recover">
          <h4>Decrypt (correct keys)</h4>
          <pre className="output">{recovered}</pre>
        </div>
      ) : null}

      {wrongKeyTry !== "" ? (
        <div className="recover recover-wrong">
          <h4>Decrypt (wrong K1) — garbage</h4>
          <pre className="output">{wrongKeyTry}</pre>
          <p className="caption">Wrong key material → useless data. 3DES is still legacy today.</p>
        </div>
      ) : null}
    </div>
  );
}
