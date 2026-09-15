import { Fragment, useEffect, useMemo, useState } from "react";
import { encryptRC4 } from "../lib/ciphers.js";
import { utf8Bytes } from "../lib/format.js";

function xorBits(a, b) {
  return a.map((bit, i) => bit ^ b[i]);
}

function byteToBits(byte) {
  return Array.from({ length: 8 }, (_, i) => (byte >> (7 - i)) & 1);
}

function bitsToByte(bits) {
  return bits.reduce((acc, bit) => (acc << 1) | bit, 0);
}

function hexByte(byte) {
  return `${byte.toString(16).padStart(2, "0")}h`;
}

/**
 * What to print above a keystream byte. Bytes past ASCII are one piece of a
 * multi-byte character, so there is no single letter to show for them.
 */
function byteGlyph(byte) {
  if (byte === 0x20) return "␣";
  if (byte > 0x20 && byte < 0x7f) return String.fromCharCode(byte);
  return "·";
}

const SAMPLE_MAX = 32;
const STREAM_PREVIEW_BYTES = 8;

/**
 * One XOR calculation stacked so the three rows line up column by column,
 * the way a student would check long addition.
 */
function XorStack({ inputLabel, inputValue, inputBits, keyBits, outputLabel, outputValue, outputBits, onFlipInput, ariaLabel }) {
  return (
    <div className="xor-stack" aria-label={ariaLabel}>
      <span className="xor-stack-corner" aria-hidden="true" />
      <span className="xor-stack-op" aria-hidden="true" />
      {inputBits.map((_, i) => (
        <span key={`pos-${i}`} className="xor-stack-pos" aria-hidden="true">
          {i + 1}
        </span>
      ))}

      <span className="xor-stack-label">
        <strong>{inputLabel}</strong>
        <em>{inputValue}</em>
      </span>
      <span className="xor-stack-op" aria-hidden="true" />
      {inputBits.map((b, i) =>
        onFlipInput ? (
          <button
            key={`in-${i}`}
            type="button"
            className={`xor-bit ${b ? "on" : "off"}`}
            onClick={() => onFlipInput(i)}
            aria-label={`${inputLabel} switch ${i + 1}, currently ${b}. Click to flip.`}
          >
            {b}
          </button>
        ) : (
          <span key={`in-${i}`} className={`xor-bit readonly ${b ? "on" : "off"}`}>
            {b}
          </span>
        ),
      )}

      <span className="xor-stack-label">
        <strong>Keystream byte</strong>
        <em>the flip instructions</em>
      </span>
      <span className="xor-stack-op">⊕</span>
      {keyBits.map((b, i) => (
        <span key={`key-${i}`} className="xor-stack-cell">
          <span className={`xor-bit readonly ${b ? "on" : "off"}`}>{b}</span>
          <span className={`xor-stack-flag ${b ? "flip" : "keep"}`}>{b ? "flip" : "keep"}</span>
        </span>
      ))}

      <span className="xor-stack-rule" aria-hidden="true" />

      <span className="xor-stack-label">
        <strong>{outputLabel}</strong>
        <em>{outputValue}</em>
      </span>
      <span className="xor-stack-op">=</span>
      {outputBits.map((b, i) => (
        <span
          key={`out-${i}`}
          className={`xor-bit readonly ${b ? "on" : "off"} ${keyBits[i] ? "flipped" : ""}`}
        >
          {b}
        </span>
      ))}
    </div>
  );
}

/** Optional deep dive — rendered below Real world for RC4. */
export default function AdvancedTopic({ plaintext, keyHex, passphrase }) {
  const [sample, setSample] = useState(() => (plaintext || "HELLO WORLD").slice(0, SAMPLE_MAX));
  const [plainBits, setPlainBits] = useState(() => byteToBits(0));
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    if (plaintext == null) return;
    setSample(plaintext.slice(0, SAMPLE_MAX));
  }, [plaintext]);

  const rc4Out = useMemo(() => {
    if (!keyHex || !sample?.length) return null;
    try {
      // Encrypt enough text so we get several keystream bytes to preview.
      const pad = sample.padEnd(STREAM_PREVIEW_BYTES, ".");
      return encryptRC4(pad.slice(0, STREAM_PREVIEW_BYTES), keyHex);
    } catch {
      return null;
    }
  }, [sample, keyHex]);

  const streamBytes = useMemo(() => {
    if (!rc4Out?.keystreamHex) return [];
    const hex = rc4Out.keystreamHex;
    const out = [];
    for (let i = 0; i + 1 < hex.length && out.length < STREAM_PREVIEW_BYTES; i += 2) {
      out.push(parseInt(hex.slice(i, i + 2), 16));
    }
    return out;
  }, [rc4Out]);

  const streamByte = streamBytes[0] ?? null;
  const streamBits = streamByte == null ? null : byteToBits(streamByte);

  const messageBytes = useMemo(() => utf8Bytes(sample), [sample]);

  const seedPlainByte = useMemo(() => {
    const bytes = utf8Bytes(sample.slice(0, 1));
    return bytes[0] ?? 0;
  }, [sample]);

  // One column per message byte, capped at the keystream bytes we previewed.
  const pairs = useMemo(
    () =>
      Array.from(messageBytes)
        .slice(0, streamBytes.length)
        .map((byte, i) => ({ glyph: byteGlyph(byte), byte: streamBytes[i] })),
    [messageBytes, streamBytes],
  );

  useEffect(() => {
    setPlainBits(byteToBits(seedPlainByte));
    setEdited(false);
  }, [seedPlainByte]);

  const cipherBits = streamBits ? xorBits(plainBits, streamBits) : null;
  const recoveredBits = cipherBits && streamBits ? xorBits(cipherBits, streamBits) : null;
  const firstChar = sample.length ? sample[0] : "?";
  const empty = streamBits == null;
  const passLabel = passphrase?.length ? passphrase : "(demo passphrase)";
  const flipCount = streamBits ? streamBits.filter((b) => b === 1).length : 0;
  const keyByteCount = Math.floor((keyHex?.length ?? 0) / 2);

  function flipPlain(index) {
    setPlainBits((prev) => prev.map((b, i) => (i === index ? b ^ 1 : b)));
    setEdited(true);
  }

  function resetBits() {
    setPlainBits(byteToBits(seedPlainByte));
    setEdited(false);
  }

  return (
    <section className="advanced-topic xor-advanced-lab">
      <header className="advanced-topic-header">
        <h2>XOR under the hood</h2>
      </header>

      <p className="caption">
        A computer stores every letter as eight tiny on/off switches — <code>1</code> is on,{" "}
        <code>0</code> is off. Encrypting a letter is nothing more than{" "}
        <strong>flipping some of those switches</strong>. The key’s only job is to decide which ones.
      </p>
      <p className="caption">
        <strong>XOR (⊕) is the flip instruction.</strong> Line up a message switch with a key switch:
        a key bit of <code>1</code> flips the message bit, a key bit of <code>0</code> leaves it
        alone.
      </p>

      <table className="xor-truth" aria-label="XOR rule as flip instructions">
        <thead>
          <tr>
            <th scope="col">Message bit</th>
            <th scope="col">Key bit</th>
            <th scope="col">Result</th>
            <th scope="col">What the key did</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>0</td>
            <td>0</td>
            <td>0</td>
            <td className="xor-truth-keep">left it alone</td>
          </tr>
          <tr>
            <td>1</td>
            <td>0</td>
            <td>1</td>
            <td className="xor-truth-keep">left it alone</td>
          </tr>
          <tr>
            <td>0</td>
            <td>1</td>
            <td>1</td>
            <td className="xor-truth-flip">flipped it</td>
          </tr>
          <tr>
            <td>1</td>
            <td>1</td>
            <td>0</td>
            <td className="xor-truth-flip">flipped it</td>
          </tr>
        </tbody>
      </table>

      <div className="xor-formula" aria-label="Encrypt and decrypt with the same XOR">
        <p className="xor-formula-label">Encryption</p>
        <p className="xor-formula-eq">
          Ciphertext = Plaintext <span aria-hidden="true">⊕</span> Keystream
        </p>
        <p className="xor-formula-label">Decryption</p>
        <p className="xor-formula-eq">
          Plaintext = Ciphertext <span aria-hidden="true">⊕</span> Keystream
        </p>
        <p className="caption xor-formula-note">Same XOR operation both times.</p>
        <p className="caption xor-formula-note">
          <strong>And there is a really important property — XOR is its own inverse:</strong>
        </p>
        <p className="xor-formula-eq">
          (Plaintext <span aria-hidden="true">⊕</span> Keystream){" "}
          <span aria-hidden="true">⊕</span> Keystream = Plaintext
        </p>
        <p className="caption xor-formula-note">
          Flip a switch twice and it is right back where it started. So the same keystream that
          encrypted the message also decrypts it — no second “undo” algorithm.
        </p>
      </div>

      <h3 className="feistel-step-title">1. Start from plaintext</h3>
      <label className="field">
        <span>Type any text — we follow the first character through the whole flip</span>
        <input
          type="text"
          value={sample}
          maxLength={SAMPLE_MAX}
          onChange={(e) => setSample(e.target.value.slice(0, SAMPLE_MAX))}
        />
      </label>

      <div className="feistel-story" aria-label="How plaintext becomes bits">
        <div className="feistel-story-step">
          <span className="feistel-story-label">Letter</span>
          <strong className="feistel-story-value">“{firstChar}”</strong>
        </div>
        <span className="feistel-story-arrow" aria-hidden="true">
          →
        </span>
        <div className="feistel-story-step">
          <span className="feistel-story-label">Its number code</span>
          <code className="feistel-story-value">{seedPlainByte}</code>
        </div>
        <span className="feistel-story-arrow" aria-hidden="true">
          →
        </span>
        <div className="feistel-story-step">
          <span className="feistel-story-label">Eight switches (one byte)</span>
          <code className="feistel-story-value">{byteToBits(seedPlainByte).join("")}</code>
        </div>
      </div>
      {edited ? (
        <p className="caption">You flipped switches by hand — they no longer match this letter.</p>
      ) : null}

      {empty ? (
        <p className="caption">Waiting for a key from the RC4 demo above…</p>
      ) : (
        <>
          <h3 className="feistel-step-title">2. One letter, one byte of instructions</h3>
          <p className="caption">
            Every letter has its own eight switches, so every letter needs its own eight flip
            instructions. Your message takes up {messageBytes.length}{" "}
            {messageBytes.length === 1 ? "byte" : "bytes"}, so it needs {messageBytes.length} of
            those instruction bytes — and a 5,000-character email would need 5,000. Your key is a
            fixed {keyByteCount} bytes no matter what you type, so it cannot cover that by itself.
          </p>
          <p className="caption">
            So RC4 treats the key as a <strong>seed</strong> and generates instruction bytes on
            demand — one after another, for as long as the message keeps going. That run of bytes is
            the <strong>keystream</strong>.
          </p>

          <div className="feistel-story" aria-label="How the keystream is made">
            <div className="feistel-story-step">
              <span className="feistel-story-label">Passphrase (demo)</span>
              <strong className="feistel-story-value">“{passLabel}”</strong>
            </div>
            <span className="feistel-story-arrow" aria-hidden="true">
              →
            </span>
            <div className="feistel-story-step">
              <span className="feistel-story-label">Seed: {keyByteCount}-byte key</span>
              <code className="feistel-story-value keystream-key-hex">{keyHex.slice(0, 16)}…</code>
            </div>
            <span className="feistel-story-arrow" aria-hidden="true">
              →
            </span>
            <div className="feistel-story-step">
              <span className="feistel-story-label">Keystream for this message</span>
              <strong className="feistel-story-value">
                {messageBytes.length} {messageBytes.length === 1 ? "byte" : "bytes"}
              </strong>
            </div>
          </div>

          <p className="caption">
            Here is your message lined up with that keystream. Each letter sits directly above the
            one byte that will flip its switches.
          </p>
          <div className="keystream-pairs" aria-label="Each message byte paired with its keystream byte">
            <span className="keystream-pair-rowlabel">Your message</span>
            <span className="keystream-pair-arrow" aria-hidden="true" />
            <span className="keystream-pair-rowlabel">Keystream</span>
            <span className="keystream-pair-index" aria-hidden="true" />

            {pairs.map((pair, i) => (
              <Fragment key={`pair-${i}`}>
                <span className={`keystream-pair-letter ${i === 0 ? "focus" : ""}`}>
                  {pair.glyph}
                </span>
                <span className="keystream-pair-arrow" aria-hidden="true">
                  ↓
                </span>
                <code className={`keystream-pair-byte ${i === 0 ? "focus" : ""}`}>
                  {pair.byte.toString(16).padStart(2, "0")}
                </code>
                <span className="keystream-pair-index">byte {i}</span>
              </Fragment>
            ))}

            {messageBytes.length > pairs.length ? (
              <Fragment>
                <span className="keystream-pair-letter more">…</span>
                <span className="keystream-pair-arrow" aria-hidden="true" />
                <span className="keystream-pair-byte more">…</span>
                <span className="keystream-pair-index">
                  +{messageBytes.length - pairs.length} more
                </span>
              </Fragment>
            ) : null}
          </div>

          <p className="caption">
            Those bytes are written in <strong>hex</strong>, which is just a short way to spell out
            eight switches. Byte 0 is <code>{streamByte.toString(16).padStart(2, "0")}</code> in hex,
            which is <code>{streamBits.join("")}</code> as switches — the eight instructions that act
            on “{firstChar}” in step 3.
          </p>

          <h3 className="feistel-step-title">3. Encrypt: let the keystream flip the switches</h3>
          <p className="caption">
            Read this one column at a time, straight down, like long addition. Each keystream switch
            either flips the message switch above it or leaves it alone. Click any plaintext switch
            and watch the bottom row follow.
          </p>

          <XorStack
            ariaLabel="Plaintext XOR keystream equals ciphertext"
            inputLabel="Plaintext byte"
            inputValue={
              edited
                ? hexByte(bitsToByte(plainBits))
                : `“${firstChar}” · ${hexByte(bitsToByte(plainBits))}`
            }
            inputBits={plainBits}
            keyBits={streamBits}
            outputLabel="Ciphertext byte"
            outputValue={hexByte(bitsToByte(cipherBits))}
            outputBits={cipherBits}
            onFlipInput={flipPlain}
          />

          <p className="caption">
            Keystream byte 0 holds {flipCount} {flipCount === 1 ? "one" : "ones"}, so {flipCount} of
            the eight switches flipped; the rest rode through untouched. The flipped columns are
            outlined below the line.
          </p>

          <div className="demo-actions">
            <button type="button" className="danger" onClick={resetBits}>
              Reset switches
            </button>
          </div>

          <h3 className="feistel-step-title">4. Decrypt: run the same flips a second time</h3>
          <p className="caption">
            Nothing new happens here. The ciphertext goes on top, the <em>same</em> keystream byte
            goes underneath, and the same {flipCount} switches flip again — which puts every one of
            them back where it started.
          </p>

          <XorStack
            ariaLabel="Ciphertext XOR the same keystream equals the original plaintext"
            inputLabel="Ciphertext byte"
            inputValue={hexByte(bitsToByte(cipherBits))}
            inputBits={cipherBits}
            keyBits={streamBits}
            outputLabel="Back to plaintext"
            outputValue={edited ? hexByte(bitsToByte(recoveredBits)) : `“${firstChar}” · ${hexByte(bitsToByte(recoveredBits))}`}
            outputBits={recoveredBits}
          />

          <p className="caption">
            The bottom row is identical to the plaintext row in step 3 — that is the whole trick.
          </p>

          <ul className="tdes-ede-notes">
            <li>
              <strong>Why XOR?</strong> One rule, applied twice, cancels itself. That is exactly what
              a cipher needs: encrypt with the keystream, decrypt with the same keystream, no second
              “undo” algorithm required.
            </li>
            <li>
              <strong>What must stay secret?</strong> The keystream, which means the key behind it.
              Anyone holding the keystream can flip the switches back. And never reuse a keystream on
              two messages — reusing the same flips on two different messages leaks both.
            </li>
          </ul>
        </>
      )}
    </section>
  );
}
