import { useEffect, useMemo, useState } from "react";
import {
  DES_BLOCK_BYTES,
  decryptDES,
  encryptDES,
  pkcs7PaddedLen,
} from "../lib/ciphers.js";
import { deriveKeyHex } from "../lib/deriveKey.js";
import { PLAINTEXT_MAX, utf8Bytes } from "../lib/format.js";

const DEFAULT_PASS = "classroom";
const KEY_BITS = 64; // DES key schedule uses 64 bits drawn; 56 effective + 8 parity

function buildPlainBlocks(plaintext) {
  const bytes = utf8Bytes(plaintext);
  const plainLen = bytes.length;
  const paddedLen = pkcs7PaddedLen(plainLen);
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
  for (let i = 0; i < cells.length; i += DES_BLOCK_BYTES) {
    blocks.push(cells.slice(i, i + DES_BLOCK_BYTES));
  }
  return { plainLen, paddedLen, padValue, blockCount: blocks.length, blocks };
}

export default function DESDemo({
  plaintext,
  setPlaintext,
  onRealWorldChange,
  onPipelineMeta,
  rwEncryptStdout,
}) {
  const [passphrase, setPassphrase] = useState(DEFAULT_PASS);
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
    onPipelineMeta?.({
      plaintext: safe,
      passphrase,
      keyHex,
      cipherB64,
      recovered,
    });
  }, [safe, passphrase, keyHex, cipherB64, recovered, onPipelineMeta]);

  useEffect(() => {
    const escaped = safe.replace(/'/g, `'\\''`);
    const passEscaped = passphrase.replace(/'/g, `'\\''`);
    const iv = "0000000000000000";
    const encCmd = `printf '${escaped}' | openssl enc -des-cbc -provider default -provider legacy -nosalt -k '${passEscaped}' -iv ${iv} -e -a`;
    const rwCipher = (rwEncryptStdout || "").trim();
    const decryptInput = rwCipher || "<run-encrypt-stdout-here>";
    onRealWorldChange?.([
      {
        id: "des-encrypt",
        title: "DES encrypt (OpenSSL)",
        caption:
          "Broken / key too short. OpenSSL 3 needs the legacy provider. -k is the passphrase; mode is DES-CBC with a visible zero IV.",
        commandText: encCmd,
        runBody: {
          part: "des",
          direction: "encrypt",
          plaintext: safe,
          passphrase,
          ivHex: iv,
        },
        applications: [
          "Legacy banking / ATM links (historically)",
          "Old VPN and enterprise protocols",
          "Replaced by 3DES, then AES — do not use for new systems",
        ],
      },
      {
        id: "des-decrypt",
        title: "DES decrypt (OpenSSL)",
        caption: rwCipher
          ? "-k is the passphrase. Uses stdout from Real-world encrypt above."
          : "-k is the passphrase. Run encrypt above first.",
        commandText: `printf '${decryptInput.replace(/'/g, `'\\''`)}' | openssl enc -des-cbc -provider default -provider legacy -nosalt -k '${passEscaped}' -iv ${iv} -d -a`,
        runBody: rwCipher
          ? {
              part: "des",
              direction: "decrypt",
              plaintext: safe,
              passphrase,
              ivHex: iv,
              inputB64: rwCipher,
            }
          : null,
        applications: [
          "Same 56-bit effective key unlocks the block(s)",
          "Wrong key → garbage (Confidentiality lesson)",
        ],
      },
    ]);
  }, [safe, passphrase, rwEncryptStdout, onRealWorldChange]);

  function onEncrypt() {
    setSelectedAction("encrypt");
    setError("");
    try {
      const out = encryptDES(safe, keyHex);
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
      const out = decryptDES(cipherB64, keyHex);
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
      const out = decryptDES(cipherB64, wrongHex);
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

  return (
    <div className="des-demo">
      <p className="banner-broken">Broken / obsolete — 56-bit key is too short. Educational only.</p>

      <label className="field">
        <span>Plaintext (max {PLAINTEXT_MAX})</span>
        <input
          type="text"
          value={safe}
          maxLength={PLAINTEXT_MAX}
          onChange={(e) => setPlaintext(e.target.value.slice(0, PLAINTEXT_MAX))}
        />
      </label>

      <section className="tdes-key-section" aria-labelledby="des-key-heading">
        <div className="tdes-key-header">
          <h3 id="des-key-heading">Key</h3>
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
          <span>Passphrase → DES key</span>
          <input type="text" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
          {showHex ? <code className="tdes-key-hex">{keyHex || "…"}</code> : null}
        </label>
        <p className="caption">
          Type the passphrase as text. We derive a 64-bit key schedule (56 effective + 8 parity).
          Mode: DES-CBC with a visible zero IV (see teach pane). ECB would repeat identical blocks —
          dangerous; CBC chains them.
          {showHex ? (
            <>
              {" "}
              IV: <code>0000000000000000</code>.
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

      <section className="des-block-visual" aria-labelledby="des-paths">
        <h3 id="des-paths">Key path vs message path</h3>
        <p className="caption">
          The passphrase is <em>not</em> cut into blocks. The plaintext <em>is</em>. Same key is used
          for every block. Each block then runs 16 Feistel rounds (Advanced Topic below).
        </p>

        <div className="des-lane">
          <h4>Passphrase → one 64-bit key</h4>
          <p className="caption">
            Drawn as 64 bits; only <strong>56 bits</strong> are effective (8 parity).
            {showHex ? (
              <>
                {" "}
                Hex: <code>{keyHex || "…"}</code>
              </>
            ) : null}
          </p>
          <div className="des-key-bar" role="img" aria-label="64-bit DES key with 8 parity bits grayed">
            <div className="des-key-effective">
              <span>56-bit effective key</span>
            </div>
            <div className="des-key-parity">
              <span>8 parity</span>
            </div>
          </div>
        </div>

        <div className="des-lane">
          <h4>Plaintext → 64-bit (8-byte) blocks in series</h4>
          <p className="caption">
            “{safe || "(empty)"}” is {layout.plainLen} byte{layout.plainLen === 1 ? "" : "s"}.
            Padding fills the last block up to the {DES_BLOCK_BYTES}-byte (64-bit) block size →{" "}
            {layout.paddedLen} bytes ({layout.blockCount} block
            {layout.blockCount === 1 ? "" : "s"}).
          </p>
          <div className="des-block-strip" role="list" aria-label="Plaintext cut into 8-byte blocks">
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
          <h4>Decrypt (correct key)</h4>
          <pre className="output">{recovered}</pre>
        </div>
      ) : null}

      {wrongKeyTry !== "" ? (
        <div className="recover recover-wrong">
          <h4>Decrypt (wrong key) — garbage</h4>
          <pre className="output">{wrongKeyTry}</pre>
          <p className="caption">Wrong key → useless data. Today a 56-bit key can also be brute-forced.</p>
        </div>
      ) : null}
    </div>
  );
}
