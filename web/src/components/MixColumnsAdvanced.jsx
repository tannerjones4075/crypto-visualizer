import { useEffect, useState } from "react";
import {
  columnBytes,
  hexByte,
  mixColumn,
  seedStateFromText,
  writeColumn,
} from "../lib/mixColumns.js";

const MIX_MATRIX = [
  ["02", "03", "01", "01"],
  ["01", "02", "03", "01"],
  ["01", "01", "02", "03"],
  ["03", "01", "01", "02"],
];

export default function MixColumnsAdvanced({ plaintext }) {
  const [state, setState] = useState(() => seedStateFromText(plaintext));
  const [beforeCol, setBeforeCol] = useState(null);
  const [afterCol, setAfterCol] = useState(null);
  const [col, setCol] = useState(0);
  const [focusRow, setFocusRow] = useState(0);
  const [showMath, setShowMath] = useState(false);
  const [mixed, setMixed] = useState(false);

  useEffect(() => {
    setState(seedStateFromText(plaintext));
    setBeforeCol(null);
    setAfterCol(null);
    setMixed(false);
    setFocusRow(0);
  }, [plaintext]);

  const focusByte = state[focusRow][col];
  const changedRows = new Set();
  if (beforeCol && afterCol) {
    for (let r = 0; r < 4; r++) {
      if (beforeCol[r] !== afterCol[r]) changedRows.add(r);
    }
  }

  function selectCell(row, column) {
    setCol(column);
    setFocusRow(row);
    if (column !== col) {
      setBeforeCol(null);
      setAfterCol(null);
      setMixed(false);
    }
  }

  function nudgeByte(delta) {
    const next = state.map((row) => row.slice());
    next[focusRow][col] = (next[focusRow][col] + delta + 256) % 256;
    setState(next);
    setBeforeCol(null);
    setAfterCol(null);
    setMixed(false);
  }

  function flipBit(bitIndex) {
    // bitIndex 0 = MSB
    const mask = 1 << (7 - bitIndex);
    const next = state.map((row) => row.slice());
    next[focusRow][col] ^= mask;
    setState(next);
    setBeforeCol(null);
    setAfterCol(null);
    setMixed(false);
  }

  function onMix() {
    const before = columnBytes(state, col);
    const after = mixColumn(before);
    setBeforeCol(before);
    setAfterCol(after);
    setState(writeColumn(state, col, after));
    setMixed(true);
  }

  function onReset() {
    setState(seedStateFromText(plaintext));
    setBeforeCol(null);
    setAfterCol(null);
    setMixed(false);
    setFocusRow(0);
  }

  return (
    <section className="advanced-topic mixcolumns-advanced">
      <header className="advanced-topic-header">
        <h2>MixColumns</h2>
      </header>

      <p className="banner-legacy">Simplified for teaching — one MixColumns step on one column, not a full AES round.</p>

      <p className="caption">
        Substitution alone is local: change one byte and only that byte changes. AES needs{" "}
        <strong>diffusion</strong> — a one-byte change must spread. MixColumns is the blend step
        that does that inside each column of the 4×4 state.
      </p>

      <div className="mix-contrast" role="note">
        <p>
          <strong>ShiftRows</strong> repositions bytes (moves them around the grid).
        </p>
        <p>
          <strong>MixColumns</strong> blends bytes (each output byte depends on all four inputs in
          the column).
        </p>
      </div>

      <h3 className="feistel-step-title">1. AES state (4×4 bytes)</h3>
      <p className="caption">
        Seeded from the demo plaintext above (first 16 bytes, padded if short). Pick a column, then
        change the focused byte. Press Mix this column and watch the column change together.
      </p>

      <div className="mix-layout">
        <div className="mix-grid-wrap">
          <div
            className="mix-grid"
            role="grid"
            aria-label="AES state as a 4 by 4 byte grid"
          >
            {state.map((row, r) => (
              <div key={`row-${r}`} className="mix-grid-row" role="row">
                {row.map((byte, c) => {
                  const selected = c === col;
                  const focused = selected && r === focusRow;
                  const changed = mixed && selected && changedRows.has(r);
                  return (
                    <button
                      key={`cell-${r}-${c}`}
                      type="button"
                      role="gridcell"
                      className={`mix-cell${selected ? " selected" : ""}${focused ? " focused" : ""}${changed ? " changed" : ""}`}
                      onClick={() => selectCell(r, c)}
                      aria-label={`Row ${r + 1}, column ${c + 1}, value ${hexByte(byte)}${changed ? ", changed" : ""}`}
                      aria-pressed={focused}
                    >
                      <code>{hexByte(byte)}</code>
                      {changed ? <span className="mix-cell-flag">changed</span> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mix-col-labels" aria-hidden="true">
            {[0, 1, 2, 3].map((c) => (
              <span key={`col-lab-${c}`} className={c === col ? "on" : ""}>
                Col {c}
              </span>
            ))}
          </div>
        </div>

        <div className="mix-controls">
          <p className="caption">
            Focused byte: column {col}, row {focusRow} · <code>{hexByte(focusByte)}</code>
          </p>
          <div className="mix-bits" aria-label="Flip bits of the focused byte">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const bit = (focusByte >> (7 - i)) & 1;
              return (
                <button
                  key={`bit-${i}`}
                  type="button"
                  className={`xor-bit ${bit ? "on" : "off"}`}
                  onClick={() => flipBit(i)}
                  aria-label={`Bit ${i + 1}, currently ${bit}. Click to flip.`}
                >
                  {bit}
                </button>
              );
            })}
          </div>
          <div className="demo-actions">
            <button type="button" onClick={() => nudgeByte(-1)} aria-label="Decrease focused byte">
              −1
            </button>
            <button type="button" onClick={() => nudgeByte(1)} aria-label="Increase focused byte">
              +1
            </button>
            <button type="button" className="action-selected" onClick={onMix}>
              Mix this column
            </button>
            <button type="button" className="danger" onClick={onReset}>
              Reset
            </button>
          </div>
          <button
            type="button"
            className={showMath ? "tdes-mode-btn selected" : "tdes-mode-btn"}
            onClick={() => setShowMath((v) => !v)}
            aria-pressed={showMath}
          >
            {showMath ? "Hide a little math" : "Show a little math"}
          </button>
        </div>
      </div>

      {beforeCol && afterCol ? (
        <>
          <h3 className="feistel-step-title">2. Column {col} before → after</h3>
          <div className="mix-before-after" aria-label={`Column ${col} before and after MixColumns`}>
            <div>
              <span className="mix-ba-label">Before</span>
              <code>{beforeCol.map(hexByte).join(" ")}</code>
            </div>
            <span aria-hidden="true">→</span>
            <div>
              <span className="mix-ba-label">After</span>
              <code>{afterCol.map(hexByte).join(" ")}</code>
            </div>
          </div>
          <p className="caption">
            {changedRows.size === 0
              ? "This mix left the column unchanged (unusual for a random change)."
              : `${changedRows.size} of the 4 bytes in the column changed — that is diffusion inside the column.`}
          </p>
        </>
      ) : (
        <p className="caption">Press Mix this column to see the blend.</p>
      )}

      {showMath ? (
        <div className="mix-math">
          <h3 className="feistel-step-title">A little math (optional)</h3>
          <p className="caption">
            Each output byte is a mix of all four inputs: multiply each input by a fixed coefficient
            in GF(2⁸), then XOR the products. AES uses this circulating matrix (hex):
          </p>
          <pre className="mix-matrix" aria-label="AES MixColumns coefficient matrix">
            {MIX_MATRIX.map((row) => row.join("  ")).join("\n")}
          </pre>
          <p className="caption">
            For column {col}
            {beforeCol
              ? ` with inputs ${beforeCol.map(hexByte).join(" ")}`
              : ""}
            , the top output byte is{" "}
            <code>
              (02·s₀) ⊕ (03·s₁) ⊕ (01·s₂) ⊕ (01·s₃)
            </code>
            . The other three rows rotate those coefficients. You do not need the field polynomial
            for the classroom story — the point is “every output depends on every input in the
            column.”
          </p>
        </div>
      ) : null}

      <p className="caption">
        <strong>CIA:</strong> diffusion makes patterns harder to exploit — still Confidentiality of
        the block cipher. Integrity is still not free (needs an HMAC or AEAD).
      </p>

      <p className="tdes-mental-model">
        MixColumns blends each column so a one-byte change spreads inside the AES block.
      </p>
    </section>
  );
}
