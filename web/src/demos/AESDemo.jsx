import { useEffect, useMemo, useState } from "react";
import {
  AES_BLOCK_BYTES,
  AES_IV_HEX,
  aesRoundsForKeyBits,
  decryptAES,
  encryptAES,
  pkcs7PaddedLen,
} from "../lib/ciphers.js";
import { deriveKeyHex } from "../lib/deriveKey.js";
import { PLAINTEXT_MAX, utf8Bytes } from "../lib/format.js";

const DEFAULT_PASS = "classroom";
const KEY_OPTIONS = [128, 192, 256];

function buildPlainBlocks(plaintext) {
  const bytes = utf8Bytes(plaintext);
  const plainLen = bytes.length;
  const paddedLen = pkcs7PaddedLen(plainLen, AES_BLOCK_BYTES);
  const padValue = paddedLen - plainLen;
  const cells = [];
  for (let i = 0; i < paddedLen; i++) {
    if (i < plainLen) {
      const b = bytes[i];
      const ch = b >= 32 && b < 127 ? String.fromCharCode(b) : "·";
      cells.push({ kind: "data", label: ch, hex: b.toString(16).padStart(2, "0") });
    } else {
      cells.push({
        kind: "pad",
        label: "·",
        hex: padValue.toString(16).padStart(2, "0"),
      });
    }
  }
  const blocks = [];
  for (let i = 0; i < cells.length; i += AES_BLOCK_BYTES) {
    blocks.push(cells.slice(i, i + AES_BLOCK_BYTES));
  }
  return { plainLen, paddedLen, padValue, blockCount: blocks.length, blocks };
}

export default function AESDemo({
  plaintext,
  setPlaintext,
  onRealWorldChange,
  rwEncryptStdout,
}) {
  const [passphrase, setPassphrase] = useState(DEFAULT_PASS);
  const [keyBits, setKeyBits] = useState(128);
  const [keyHex, setKeyHex] = useState("");
  const [cipherB64, setCipherB64] = useState("");
  const [plainBytes, setPlainBytes] = useState(0);
  const [paddedBytes, setPaddedBytes] = useState(0);
  const [recovered, setRecovered] = useState("");
  const [wrongKeyTry, setWrongKeyTry] = useState("");
  const [error, setError] = useState("");
  const [selectedAction, setSelectedAction] = useState(null);
  const [showHex, setShowHex] = useState(false);

  const safe = plaintext.slice(0, PLAINTEXT_MAX);
  const layout = useMemo(() => buildPlainBlocks(safe), [safe]);
  const rounds = aesRoundsForKeyBits(keyBits);
  const cipherName = `aes-${keyBits}-cbc`;

  useEffect(() => {
    let cancelled = false;
    deriveKeyHex(passphrase, keyBits).then((hex) => {
      if (!cancelled) setKeyHex(hex);
    });
    return () => {
      cancelled = true;
    };
  }, [passphrase, keyBits]);

  useEffect(() => {
    const escaped = safe.replace(/'/g, `'\\''`);
    const passEscaped = passphrase.replace(/'/g, `'\\''`);
    const encCmd = `printf '${escaped}' | openssl enc -${cipherName} -nosalt -k '${passEscaped}' -iv ${AES_IV_HEX} -e -a`;
    const rwCipher = (rwEncryptStdout || "").trim();
    const decryptInput = rwCipher || "<run-encrypt-stdout-here>";
    onRealWorldChange?.([
      {
        id: "aes-encrypt",
        title: "AES encrypt (OpenSSL)",
        caption:
          "Current bulk cipher. -k is the passphrase (OpenSSL derives the key). Mode is AES-CBC with a visible zero IV — browser key hex is independent.",
        commandText: encCmd,
        runBody: {
          part: "aes",
          direction: "encrypt",
          plaintext: safe,
          passphrase,
          keyBits,
          ivHex: AES_IV_HEX,
        },
        applications: [
          "TLS, disk encryption, Wi-Fi (WPA2/WPA3), VPNs",
          "Default choice for bulk Confidentiality today",
          "Pair with an HMAC or use AEAD when Integrity also matters",
        ],
      },
      {
        id: "aes-decrypt",
        title: "AES decrypt (OpenSSL)",
        caption: rwCipher
          ? "-k is the passphrase. Uses stdout from Real-world encrypt above."
          : "-k is the passphrase. Run encrypt above first.",
        commandText: `printf '${decryptInput.replace(/'/g, `'\\''`)}' | openssl enc -${cipherName} -nosalt -k '${passEscaped}' -iv ${AES_IV_HEX} -d -a`,
        runBody: rwCipher
          ? {
              part: "aes",
              direction: "decrypt",
              plaintext: safe,
              passphrase,
              keyBits,
              ivHex: AES_IV_HEX,
              inputB64: rwCipher,
            }
          : null,
        applications: [
          "Same key size unlocks the block(s)",
          "Wrong key → garbage (Confidentiality lesson)",
        ],
      },
    ]);
  }, [safe, passphrase, keyBits, cipherName, rwEncryptStdout, onRealWorldChange]);

  async function onEncrypt() {
    setSelectedAction("encrypt");
    setError("");
    try {
      const out = await encryptAES(safe, keyHex);
      setCipherB64(out.b64);
      setPlainBytes(out.plainBytes);
      setPaddedBytes(out.paddedBytes);
      setRecovered("");
      setWrongKeyTry("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function onDecrypt() {
    setSelectedAction("decrypt");
    setError("");
    if (!cipherB64) {
      setError("Encrypt first.");
      return;
    }
    try {
      const out = await decryptAES(cipherB64, keyHex);
      if (out.failed) {
        setError("Decrypt failed.");
        return;
      }
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
      const wrongHex = await deriveKeyHex(passphrase + "-wrong", keyBits);
      const out = await decryptAES(cipherB64, wrongHex);
      setWrongKeyTry(out.failed ? "(non-UTF-8 garbage / padding failed)" : out.text || out.hex || "(garbage)");
      setRecovered("");
    } catch (err) {
      setWrongKeyTry("(non-UTF-8 garbage / padding failed)");
      setRecovered("");
      setError("");
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

  return (
    <div className="aes-demo">
      <p className="banner-current">Current — modern bulk Confidentiality. Prefer AEAD when Integrity also matters.</p>

      <label className="field">
        <span>Plaintext (max {PLAINTEXT_MAX})</span>
        <input
          type="text"
          value={safe}
          maxLength={PLAINTEXT_MAX}
          onChange={(e) => setPlaintext(e.target.value.slice(0, PLAINTEXT_MAX))}
        />
      </label>

      <section className="tdes-key-section" aria-labelledby="aes-key-heading">
        <div className="tdes-key-header">
          <h3 id="aes-key-heading">Key</h3>
          <button
            type="button"
            className={showHex ? "tdes-mode-btn selected" : "tdes-mode-btn"}
            onClick={() => setShowHex((v) => !v)}
            aria-pressed={showHex}
          >
            {showHex ? "Hide hex" : "Show in hex"}
          </button>
        </div>

        <div className="tdes-key-mode" role="group" aria-label="AES key size">
          {KEY_OPTIONS.map((bits) => (
            <button
              key={bits}
              type="button"
              className={keyBits === bits ? "tdes-mode-btn selected" : "tdes-mode-btn"}
              onClick={() => setKeyBits(bits)}
            >
              {bits}
            </button>
          ))}
        </div>

        <label className="field">
          <span>Passphrase → AES-{keyBits} key</span>
          <input type="text" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
          {showHex ? <code className="tdes-key-hex">{keyHex || "…"}</code> : null}
        </label>

        <div className="tdes-key-bar" role="img" aria-label={`${keyBits}-bit AES key`}>
          <div className="tdes-key-fill" style={{ width: `${(keyBits / 256) * 100}%` }}>
            <span>{keyBits}-bit key · {rounds} rounds</span>
          </div>
        </div>

        <p className="caption">
          Type the passphrase as text. We derive a {keyBits}-bit key (SHA-256, truncated). AES-
          {keyBits} runs <strong>{rounds} rounds</strong> per block. Mode: AES-CBC with a visible
          zero IV. ECB would repeat identical blocks — dangerous; CBC chains them.
          {showHex ? (
            <>
              {" "}
              IV: <code>{AES_IV_HEX}</code>.
            </>
          ) : null}
        </p>
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

      <section className="aes-story" aria-labelledby="aes-story-heading">
        <h3 id="aes-story-heading">Inside Each Block</h3>
        <p className="caption">
          Each 128-bit block is worked over in rounds. Changing the key size changes how many times
          that loop runs ({rounds} for AES-{keyBits}). MixColumns detail lives in Advanced below.
        </p>
        <div className="aes-story-flow" aria-hidden="true">
          <div className="aes-story-step">
            <span className="aes-story-label">1</span>
            <strong>Add key</strong>
            <span className="caption">mix in round key material</span>
          </div>
          <span className="aes-story-arrow">→</span>
          <div className="aes-story-step">
            <span className="aes-story-label">2</span>
            <strong>Scramble</strong>
            <span className="caption">substitute &amp; shift bytes</span>
          </div>
          <span className="aes-story-arrow">→</span>
          <div className="aes-story-step">
            <span className="aes-story-label">3</span>
            <strong>Mix</strong>
            <span className="caption">blend columns (diffusion)</span>
          </div>
          <span className="aes-story-arrow">→</span>
          <div className="aes-story-step">
            <span className="aes-story-label">×{rounds}</span>
            <strong>Rounds</strong>
            <span className="caption">repeat for this key size</span>
          </div>
        </div>
      </section>

      <section className="des-block-visual" aria-labelledby="aes-paths">
        <h3 id="aes-paths">Key path vs message path</h3>
        <p className="caption">
          The passphrase is <em>not</em> cut into blocks. The plaintext <em>is</em>. Same key is used
          for every block. Each block then runs {rounds} AES rounds.
        </p>

        <div className="des-lane">
          <h4>Passphrase → one {keyBits}-bit key</h4>
          <p className="caption">
            {keyBits} bits → {rounds} rounds.
            {showHex ? (
              <>
                {" "}
                Hex: <code>{keyHex || "…"}</code>
              </>
            ) : null}
          </p>
        </div>

        <div className="des-lane">
          <h4>Plaintext → 128-bit (16-byte) blocks in series</h4>
          <p className="caption">
            “{safe || "(empty)"}” is {layout.plainLen} byte{layout.plainLen === 1 ? "" : "s"}.
            Padding fills the last block up to the {AES_BLOCK_BYTES}-byte (128-bit) block size →{" "}
            {layout.paddedLen} bytes ({layout.blockCount} block
            {layout.blockCount === 1 ? "" : "s"}).
          </p>
          <div className="des-block-strip" role="list" aria-label="Plaintext cut into 16-byte blocks">
            {layout.blocks.map((block, bi) => (
              <div key={bi} className="des-plain-block" role="listitem">
                <span className="des-plain-block-label">Block {bi + 1}</span>
                <div className="des-byte-cells">
                  {block.map((cell, ci) => (
                    <span
                      key={ci}
                      className={`des-byte-cell ${cell.kind === "pad" ? "pad" : "data"}`}
                      title={`${cell.hex}h`}
                    >
                      {cell.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {cipherB64 ? (
        <div className="cipher-out">
          <h3>Ciphertext output</h3>
          <p className="caption">
            “{safe}” was {plainBytes} bytes; padding completed each {AES_BLOCK_BYTES}-byte block →{" "}
            {paddedBytes} bytes. Base64 is not part of encryption — it only packages ciphertext bytes
            as printable text for transport (for example so binary data and awkward empty spaces can
            travel safely as characters).
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
          <p className="caption">Wrong key → useless data. That is Confidentiality working.</p>
        </div>
      ) : null}
    </div>
  );
}
