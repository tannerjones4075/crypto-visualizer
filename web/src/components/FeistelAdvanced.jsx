import { useEffect, useState } from "react";
import { utf8Bytes } from "../lib/format.js";

/** 8-bit Feistel (4|4) for teaching — not real DES size. */
function fBox(r, roundKey) {
  return (r + roundKey) % 16;
}

function feistelRound(left, right, roundKey) {
  const f = fBox(right, roundKey);
  return { left: right, right: left ^ f, f };
}

function toNibbleBits(n) {
  return [(n >> 3) & 1, (n >> 2) & 1, (n >> 1) & 1, n & 1];
}

function bitsToNibble(bits) {
  return bits.reduce((acc, b) => (acc << 1) | b, 0);
}

function bitsString(bits) {
  return bits.join("");
}

function seedFromText(text) {
  const bytes = utf8Bytes(text ?? "");
  if (!bytes.length) return 0b10110100;
  return bytes[0];
}

const ROUND_KEYS = [3, 7, 11, 5];
const SAMPLE_MAX = 32;

export default function FeistelAdvanced({ plaintext }) {
  const [sample, setSample] = useState(() => (plaintext || "HELLO WORLD").slice(0, SAMPLE_MAX));
  const [leftBits, setLeftBits] = useState(() => {
    const b = seedFromText(plaintext || "HELLO WORLD");
    return toNibbleBits((b >> 4) & 0xf);
  });
  const [rightBits, setRightBits] = useState(() => {
    const b = seedFromText(plaintext || "HELLO WORLD");
    return toNibbleBits(b & 0xf);
  });
  const [round, setRound] = useState(0);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (plaintext == null) return;
    setSample(plaintext.slice(0, SAMPLE_MAX));
  }, [plaintext]);

  useEffect(() => {
    const b = seedFromText(sample);
    setLeftBits(toNibbleBits((b >> 4) & 0xf));
    setRightBits(toNibbleBits(b & 0xf));
    setRound(0);
    setHistory([]);
  }, [sample]);

  const seedByte = seedFromText(sample);
  const left = bitsToNibble(leftBits);
  const right = bitsToNibble(rightBits);
  const firstChar = sample.length ? sample[0] : "?";
  const byteBits = [
    ...toNibbleBits((seedByte >> 4) & 0xf),
    ...toNibbleBits(seedByte & 0xf),
  ];

  const nextK = round < ROUND_KEYS.length ? ROUND_KEYS[round] : null;
  const seedL = (seedByte >> 4) & 0xf;
  const seedR = seedByte & 0xf;
  const bitsEdited = round === 0 && (left !== seedL || right !== seedR);
  const preview =
    nextK != null
      ? (() => {
          const next = feistelRound(left, right, nextK);
          return { k: nextK, f: next.f, newL: next.left, newR: next.right };
        })()
      : null;

  function flip(side, index) {
    if (round !== 0) return;
    const setter = side === "L" ? setLeftBits : setRightBits;
    setter((prev) => prev.map((b, i) => (i === index ? b ^ 1 : b)));
  }

  function stepForward() {
    if (round >= ROUND_KEYS.length) return;
    const k = ROUND_KEYS[round];
    const next = feistelRound(left, right, k);
    setHistory((h) => [...h, { left, right, k, f: next.f, newL: next.left, newR: next.right }]);
    setLeftBits(toNibbleBits(next.left));
    setRightBits(toNibbleBits(next.right));
    setRound((r) => r + 1);
  }

  function stepBack() {
    if (round <= 0 || history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setLeftBits(toNibbleBits(prev.left));
    setRightBits(toNibbleBits(prev.right));
    setRound((r) => r - 1);
  }

  function reset() {
    const b = seedFromText(sample);
    setLeftBits(toNibbleBits((b >> 4) & 0xf));
    setRightBits(toNibbleBits(b & 0xf));
    setRound(0);
    setHistory([]);
  }

  return (
    <section className="advanced-topic feistel-advanced">
      <header className="advanced-topic-header">
        <h2>Feistel network</h2>
      </header>

      <p className="caption">
        DES does not scramble a whole block in one shot. It cuts the block in half, then repeats a
        simple mix many times (“rounds”). That cut-and-mix pattern is called a Feistel network.
      </p>
      <p className="caption">
        Why bother? After the rounds finish, you can decrypt by doing the same mix again — just use
        the round keys backward. Same machine, reverse keys.
      </p>
      <p className="caption">
        Real DES: 64-bit block → 32 | 32, sixteen rounds. Here: 8-bit example → 4 | 4, four rounds,
        so you can watch every bit.
      </p>

      <h3 className="feistel-step-title">1. Start from plaintext</h3>
      <label className="field">
        <span>Type any text — we only use the first character</span>
        <input
          type="text"
          value={sample}
          maxLength={SAMPLE_MAX}
          onChange={(e) => setSample(e.target.value.slice(0, SAMPLE_MAX))}
        />
      </label>

      <div className="feistel-story" aria-label="How plaintext becomes two halves">
        <div className="feistel-story-step">
          <span className="feistel-story-label">Letter</span>
          <strong className="feistel-story-value">“{firstChar}”</strong>
        </div>
        <span className="feistel-story-arrow" aria-hidden="true">
          →
        </span>
        <div className="feistel-story-step">
          <span className="feistel-story-label">One byte (8 bits)</span>
          <code className="feistel-story-value">{bitsString(byteBits)}</code>
        </div>
        <span className="feistel-story-arrow" aria-hidden="true">
          →
        </span>
        <div className="feistel-story-step">
          <span className="feistel-story-label">Split in half</span>
          <code className="feistel-story-value">
            L {bitsString(toNibbleBits(seedL))} | R {bitsString(toNibbleBits(seedR))}
          </code>
        </div>
      </div>
      {bitsEdited ? (
        <p className="caption">
          You flipped bits below — the live halves no longer match this letter’s byte.
        </p>
      ) : null}

      <h3 className="feistel-step-title">
        2. Two cards — Left and Right (round {round} of {ROUND_KEYS.length})
      </h3>
      <p className="caption">
        {round === 0
          ? "Each half is a card. Click bits on a card to flip them, then watch one round move the cards."
          : "Cards update each round. Reset or change the plaintext to start over."}
      </p>

      <div className="feistel-cards-board" aria-label="Feistel round as two cards">
        <div className="feistel-cards-col">
          <p className="feistel-cards-heading">Now</p>
          <div className="feistel-cards-row">
            <div className="feistel-card feistel-card-l">
              <span className="feistel-card-corner">L</span>
              <span className="feistel-card-title">Left</span>
              <div className="xor-bits">
                {leftBits.map((b, i) => (
                  <button
                    key={`L-${i}`}
                    type="button"
                    className={`xor-bit ${b ? "on" : "off"}`}
                    onClick={() => flip("L", i)}
                    disabled={round !== 0}
                    aria-label={`Left bit ${i + 1}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
            <div className="feistel-card feistel-card-r">
              <span className="feistel-card-corner">R</span>
              <span className="feistel-card-title">Right</span>
              <div className="xor-bits">
                {rightBits.map((b, i) => (
                  <button
                    key={`R-${i}`}
                    type="button"
                    className={`xor-bit ${b ? "on" : "off"}`}
                    onClick={() => flip("R", i)}
                    disabled={round !== 0}
                    aria-label={`Right bit ${i + 1}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="feistel-cards-mid" aria-hidden="true">
          <div className="feistel-cards-flow">
            <span className="feistel-flow-line">R card slides → becomes new L</span>
            <span className="feistel-flow-line">
              L ⊕ F(R, key{preview ? ` ${preview.k}` : ""}) → new R
            </span>
            <span className="feistel-flow-arrow">→</span>
          </div>
        </div>

        <div className="feistel-cards-col">
          <p className="feistel-cards-heading">
            {preview ? "After one round" : "Done"}
          </p>
          <div className="feistel-cards-row">
            {preview ? (
              <>
                <div className="feistel-card feistel-card-next feistel-card-l">
                  <span className="feistel-card-corner">L′</span>
                  <span className="feistel-card-title">Was R</span>
                  <code className="feistel-card-bits">
                    {bitsString(toNibbleBits(preview.newL))}
                  </code>
                </div>
                <div className="feistel-card feistel-card-next feistel-card-r">
                  <span className="feistel-card-corner">R′</span>
                  <span className="feistel-card-title">L ⊕ F</span>
                  <code className="feistel-card-bits">
                    {bitsString(toNibbleBits(preview.newR))}
                  </code>
                </div>
              </>
            ) : (
              <>
                <div className="feistel-card feistel-card-l">
                  <span className="feistel-card-corner">L</span>
                  <span className="feistel-card-title">Left</span>
                  <code className="feistel-card-bits">{bitsString(leftBits)}</code>
                </div>
                <div className="feistel-card feistel-card-r">
                  <span className="feistel-card-corner">R</span>
                  <span className="feistel-card-title">Right</span>
                  <code className="feistel-card-bits">{bitsString(rightBits)}</code>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <h3 className="feistel-step-title">3. What one round does</h3>
      <p className="caption">
        Round keys here are fixed for the example:{" "}
        <code>{ROUND_KEYS.join(", ")}</code> — one number per round. They are{" "}
        <em>not</em> taken from your DES passphrase. In real DES, the secret key is expanded into
        sixteen round keys; we just pick four small numbers so the mix is easy to follow.
      </p>
      {preview ? (
        <div className="feistel-preview">
          <p className="caption">
            Round {round + 1} uses key{" "}
            <strong>{preview.k}</strong> (from that list). Press “Do round” to apply:
          </p>
          <ol className="feistel-preview-list">
            <li>
              Scramble the right half with the key:{" "}
              <code>
                F(R={bitsString(rightBits)}, key={preview.k}) = {preview.f}
              </code>{" "}
              (F = add, then wrap at 16)
            </li>
            <li>
              New left = old right → <code>{bitsString(toNibbleBits(preview.newL))}</code>
            </li>
            <li>
              New right = old left XOR that scramble →{" "}
              <code>
                {bitsString(leftBits)} XOR {preview.f.toString(2).padStart(4, "0")} ={" "}
                {bitsString(toNibbleBits(preview.newR))}
              </code>
            </li>
          </ol>
        </div>
      ) : (
        <p className="caption">
          All four rounds done — this is the scrambled result. “Undo round” walks
          backward (same idea as decrypt with reversed keys).
        </p>
      )}

      <div className="demo-actions">
        <button
          type="button"
          className="action-selected"
          onClick={stepForward}
          disabled={round >= ROUND_KEYS.length}
        >
          Do round
        </button>
        <button type="button" onClick={stepBack} disabled={round <= 0}>
          Undo round
        </button>
        <button type="button" className="danger" onClick={reset}>
          Reset
        </button>
      </div>

      {history.length > 0 ? (
        <>
          <h3 className="feistel-step-title">Rounds so far</h3>
          <ol className="feistel-log">
            {history.map((h, i) => (
              <li key={i}>
                Round {i + 1} (key {h.k}): L {bitsString(toNibbleBits(h.left))} | R{" "}
                {bitsString(toNibbleBits(h.right))} → L {bitsString(toNibbleBits(h.newL))} | R{" "}
                {bitsString(toNibbleBits(h.newR))}
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </section>
  );
}
