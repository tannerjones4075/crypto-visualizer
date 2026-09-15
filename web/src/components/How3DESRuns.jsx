import { Fragment } from "react";
import { DES_BLOCK_BYTES, pkcs7PaddedLen } from "../lib/ciphers.js";
import { utf8Bytes } from "../lib/format.js";

/**
 * The message cut the way the cipher actually cuts it: 8-byte blocks, with the
 * PKCS7 pad filling out the last one.
 */
function messageBlocks(text) {
  const bytes = utf8Bytes(text);
  const count = pkcs7PaddedLen(bytes.length) / DES_BLOCK_BYTES;
  const decoder = new TextDecoder("utf-8", { fatal: false });
  return Array.from({ length: count }, (_, i) => {
    const slice = bytes.slice(i * DES_BLOCK_BYTES, (i + 1) * DES_BLOCK_BYTES);
    return {
      text: decoder.decode(slice),
      bytes: slice.length,
      pad: DES_BLOCK_BYTES - slice.length,
    };
  });
}

function OpBox({ num, op, keyLabel, keyValue }) {
  const isDecrypt = op === "Decrypt";
  return (
    <div className={`ede-step${isDecrypt ? " ede-step-d" : ""}`}>
      <span className="ede-step-letter" aria-hidden="true">
        {isDecrypt ? "D" : "E"}
      </span>
      <div className="ede-step-body">
        <span className="ede-step-num">Step {num}</span>
        <span className="ede-step-op">{op}</span>
        <span className="ede-step-key">
          {keyLabel} · “{keyValue || "…"}”
        </span>
      </div>
    </div>
  );
}

function EndpointBox({ label, meta }) {
  return (
    <div className="ede-endpoint">
      <span className="ede-endpoint-label">{label}</span>
      <span className="ede-endpoint-meta">{meta}</span>
    </div>
  );
}

/** The gap between two boxes, labelled with what is travelling through it. */
function Flow({ dir, label }) {
  return (
    <span className="ede-flow" aria-hidden="true">
      <span className="ede-flow-arrow">{dir === "up" ? "↑" : "↓"}</span>
      <span className="ede-flow-label">{label}</span>
    </span>
  );
}

// One label per gap, so every arrow says which operation's output it carries.
const FLOW_LABELS = ["block goes in", "step 1 result", "step 2 result", "step 3 result"];

export default function How3DESRuns({
  plaintext = "",
  k1Plain = "",
  k2Plain = "",
  k3Plain = "",
  keyCount = 3,
  cipherB64 = "",
  recovered = "",
}) {
  const k3Label = keyCount === 2 ? "K1" : "K3";
  const k3Value = keyCount === 2 ? k1Plain : k3Plain;
  const keysEqual = k1Plain === k2Plain && k2Plain === k3Value;
  const blocks = messageBlocks(plaintext);

  // Encrypt reads top to bottom; decrypt reads the same rows bottom to top, so
  // each row pairs an operation with its inverse under the same key.
  const rows = [
    {
      left: { kind: "endpoint", label: "Plaintext block", meta: "64 bits · start" },
      right: { kind: "endpoint", label: "Plaintext block", meta: "64 bits · end" },
    },
    {
      left: { kind: "op", num: 1, op: "Encrypt", keyLabel: "K1", keyValue: k1Plain },
      right: { kind: "op", num: 3, op: "Decrypt", keyLabel: "K1", keyValue: k1Plain },
    },
    {
      left: { kind: "op", num: 2, op: "Decrypt", keyLabel: "K2", keyValue: k2Plain },
      right: { kind: "op", num: 2, op: "Encrypt", keyLabel: "K2", keyValue: k2Plain },
    },
    {
      left: { kind: "op", num: 3, op: "Encrypt", keyLabel: k3Label, keyValue: k3Value },
      right: { kind: "op", num: 1, op: "Decrypt", keyLabel: k3Label, keyValue: k3Value },
    },
    {
      left: { kind: "endpoint", label: "Ciphertext block", meta: "64 bits · end" },
      right: { kind: "endpoint", label: "Ciphertext block", meta: "64 bits · start" },
    },
  ];

  return (
    <section className="how-3des-runs" aria-labelledby="how-3des-heading">
      <header className="how-3des-header">
        <h2 id="how-3des-heading">How 3DES runs</h2>
      </header>

      <p className="tdes-takeaway">3DES runs DES three times on every block.</p>
      <p className="tdes-takeaway-sub">
        Same 64-bit blocks as DES. Same DES operation. There are just three of them per block
        instead of one.
      </p>

      <article className="tdes-section">
        <h3 className="tdes-section-title">Blocks vs. operations</h3>
        <p className="caption">
          The message is split into <strong>blocks</strong>. Each block then goes through three DES{" "}
          <strong>operations</strong>. Those are two different splits.
        </p>

        <div className="tdes-blocks-strip" aria-label="The message split into 64-bit blocks">
          {blocks.map((block, i) => (
            <div key={`block-${i}`} className={`tdes-block${i === 0 ? " focus" : ""}`}>
              <span className="tdes-block-num">Block {i + 1}</span>
              <code className="tdes-block-text">{block.text || "—"}</code>
              <span className="tdes-block-bytes">
                {block.bytes}/8 bytes{block.pad ? ` + ${block.pad} pad` : ""}
              </span>
            </div>
          ))}
        </div>

        <span className="tdes-blocks-zoom" aria-hidden="true">
          inside block 1 ↓
        </span>

        <div className="tdes-ops-strip" aria-label="Three DES operations inside one block">
          <span className="tdes-op-chip">Encrypt · K1</span>
          <span className="tdes-ops-arrow" aria-hidden="true">
            →
          </span>
          <span className="tdes-op-chip d">Decrypt · K2</span>
          <span className="tdes-ops-arrow" aria-hidden="true">
            →
          </span>
          <span className="tdes-op-chip">Encrypt · {k3Label}</span>
        </div>

        <p className="caption">
          Every block takes that same three-operation trip. CBC links the blocks together the way it
          did in DES, starting from a zero IV (<code>0000000000000000</code>).
        </p>
      </article>

      <article className="tdes-section">
        <h3 className="tdes-section-title">E → D → E</h3>
        <p className="caption">
          Encrypt runs down the left. Decrypt runs back up the right. Each operation hands its
          64-bit result to the next one.
        </p>

        <div
          className="ede-mirror"
          role="group"
          aria-label="Encrypt reads top to bottom. Decrypt reads bottom to top, reversing each operation in turn."
        >
          <div className="ede-mirror-head">
            <span className="ede-mirror-title">Encrypt</span>
            <span className="ede-mirror-ops">E → D → E</span>
            <span className="ede-mirror-keys">
              K1 → K2 → {k3Label}
            </span>
          </div>
          <div className="ede-mirror-head">
            <span className="ede-mirror-title">Decrypt</span>
            <span className="ede-mirror-ops">D → E → D</span>
            <span className="ede-mirror-keys">
              {k3Label} → K2 → K1
            </span>
          </div>

          {rows.map((row, i) => (
            <Fragment key={`row-${i}`}>
              <div className="ede-cell">
                {i > 0 ? <Flow dir="down" label={FLOW_LABELS[i - 1]} /> : null}
                {row.left.kind === "op" ? <OpBox {...row.left} /> : <EndpointBox {...row.left} />}
              </div>
              <div className="ede-cell">
                {i > 0 ? <Flow dir="up" label={FLOW_LABELS[rows.length - 1 - i]} /> : null}
                {row.right.kind === "op" ? <OpBox {...row.right} /> : <EndpointBox {...row.right} />}
              </div>
            </Fragment>
          ))}
        </div>

        <p className="caption">
          Read any row straight across: the same key, the opposite operation. Decryption walks the
          encryption process backward and reverses each step, which is why the keys run{" "}
          <strong>K1 → K2 → {k3Label}</strong> one way and <strong>{k3Label} → K2 → K1</strong> the
          other.
        </p>
      </article>

      <aside className="tdes-callout">
        <h3 className="tdes-section-title">Step 2 says “Decrypt” — your message is not being decrypted</h3>
        <p>
          Decrypt here means <strong>the inverse DES operation</strong>, applied to 64 bits. It runs
          under a different key (K2), so it does not undo step 1 — it scrambles the block further.
          The message is still on its way to becoming ciphertext.
        </p>
      </aside>

      <article className="tdes-section">
        <h3 className="tdes-section-title">Why the middle operation is a Decrypt</h3>
        <p className="caption">
          Compatibility with older DES systems. Set K1, K2, and K3 all to the same value and steps 1
          and 2 cancel, leaving a single Encrypt — plain DES. That let a 3DES machine still talk to a
          DES-only machine. The strength of 3DES comes from running DES three times under separate
          keys, not from the E‑D‑E ordering.
        </p>
        {keysEqual ? (
          <p className="caption tdes-live-note">
            Your keys are identical right now, so the demo above is doing exactly that — collapsing
            to single DES. Change K2 to see three real operations.
          </p>
        ) : null}
      </article>

      <article className="tdes-section">
        <h3 className="tdes-section-title">Why we show Base64</h3>
        <p className="caption">
          Base64 is not part of encryption. Ciphertext is raw bytes; Base64 only packages those bytes
          as printable text for transport — for example so binary data and awkward empty spaces can
          travel safely as characters. Anyone can unwrap Base64; the key still protects the message.
        </p>
        <div className="tdes-b64-flow" aria-label="Where Base64 sits">
          <span className="tdes-b64-step">3DES</span>
          <span className="tdes-ops-arrow" aria-hidden="true">
            →
          </span>
          <span className="tdes-b64-step">ciphertext bytes</span>
          <span className="tdes-ops-arrow" aria-hidden="true">
            →
          </span>
          <span className="tdes-b64-step b64">Base64</span>
          <span className="tdes-ops-arrow" aria-hidden="true">
            →
          </span>
          <span className="tdes-b64-step">text on screen</span>
        </div>

        <div className="tdes-run" aria-label="Values from the demo above">
          <span className="tdes-run-label">You typed</span>
          <code className="tdes-run-value">{plaintext || "…"}</code>
          <span className="tdes-run-label">Ciphertext, in Base64</span>
          <code className="tdes-run-value">{cipherB64 || "…"}</code>
          <span className="tdes-run-label">Decrypted back</span>
          <code className="tdes-run-value">{recovered || "…"}</code>
        </div>
        {!cipherB64 ? (
          <p className="caption tdes-live-note">Press Encrypt in the demo above to fill these in.</p>
        ) : null}
      </article>

      <p className="tdes-mental-model">
        Encrypt → reverse → encrypt. Then reverse the whole thing to decrypt.
      </p>
    </section>
  );
}
