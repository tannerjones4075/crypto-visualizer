import { DES_BLOCK_BYTES, pkcs7PaddedLen } from "../lib/ciphers.js";
import { utf8Bytes } from "../lib/format.js";

function displayBlocks(text) {
  const bytes = utf8Bytes(text);
  const paddedLength = pkcs7PaddedLen(bytes.length);

  return Array.from({ length: paddedLength / DES_BLOCK_BYTES }, (_, blockIndex) => {
    const start = blockIndex * DES_BLOCK_BYTES;
    const data = Array.from(bytes.slice(start, start + DES_BLOCK_BYTES));
    const padCount = DES_BLOCK_BYTES - data.length;
    const cells = [
      ...data.map((byte) => ({
        kind: "data",
        label: byte >= 32 && byte < 127 ? String.fromCharCode(byte) : "·",
      })),
      ...Array.from({ length: padCount }, () => ({ kind: "pad", label: "·" })),
    ];

    return { cells, dataCount: data.length, padCount };
  });
}

function Block({ block, index, compact = false }) {
  return (
    <div className={`des-how-block${index === 0 ? " focus" : ""}${compact ? " compact" : ""}`}>
      <span className="des-how-block-label">Block {index + 1} · 64 bits</span>
      <span className="des-how-block-cells">
        {block.cells.map((cell, cellIndex) => (
          <span
            key={`${index}-${cellIndex}`}
            className={`des-how-byte ${cell.kind}`}
            aria-label={cell.kind === "pad" ? "padding byte" : `data byte ${cell.label}`}
          >
            {cell.label}
          </span>
        ))}
      </span>
      <span className="des-how-block-meta">
        {block.dataCount}/8 data bytes
        {block.padCount ? ` + ${block.padCount} pad` : ""}
      </span>
    </div>
  );
}

function Endpoint({ label, detail }) {
  return (
    <div className="ede-endpoint">
      <span className="ede-endpoint-label">{label}</span>
      <span className="ede-endpoint-meta">{detail}</span>
    </div>
  );
}

function DesOperation({ operation, keyLabel }) {
  const decrypt = operation === "Decrypt";
  return (
    <div className={`ede-step${decrypt ? " ede-step-d" : ""}`}>
      <span className="ede-step-letter" aria-hidden="true">
        {decrypt ? "D" : "E"}
      </span>
      <div className="ede-step-body">
        <span className="ede-step-op">{operation}</span>
        <span className="ede-step-key">{keyLabel}</span>
      </div>
    </div>
  );
}

export default function HowDESRuns({
  plaintext = "",
  passphrase = "",
  keyHex = "",
  cipherB64 = "",
  recovered = "",
}) {
  const blocks = displayBlocks(plaintext);

  return (
    <section className="how-3des-runs des-how-runs" aria-labelledby="how-des-heading">
      <header className="how-3des-header">
        <h2 id="how-des-heading">How DES runs</h2>
      </header>

      <p className="tdes-takeaway">
        DES runs one DES operation on every 64-bit block using one key.
      </p>
      <p className="tdes-takeaway-sub">
        The message is split into blocks. The key is not: the same key works on every block.
      </p>

      <article className="tdes-section">
        <h3 className="tdes-section-title">Blocks vs. operation</h3>
        <p className="caption">
          First split the message into 8-byte blocks. Then run each block through DES once.
        </p>

        <div className="tdes-blocks-strip" role="list" aria-label="Message split into 64-bit blocks">
          {blocks.map((block, index) => (
            <div key={`message-block-${index}`} role="listitem">
              <Block block={block} index={index} />
            </div>
          ))}
        </div>

        <span className="tdes-blocks-zoom" aria-hidden="true">
          inside block 1 ↓
        </span>

        <div className="des-how-one-operation" role="group" aria-label="One DES encryption operation">
          <Endpoint label="Plaintext block" detail="64 bits" />
          <span className="des-how-arrow" aria-hidden="true">→</span>
          <DesOperation operation="Encrypt" keyLabel="with K" />
          <span className="des-how-arrow" aria-hidden="true">→</span>
          <Endpoint label="Ciphertext block" detail="64 bits" />
        </div>

        <p className="caption">
          Every block follows this same path. DES performs one DES operation per block; 3DES
          performs three.
        </p>
      </article>

      <article className="tdes-section">
        <h3 className="tdes-section-title">One key works on every block</h3>
        <div className="des-how-key-card">
          <span className="des-how-key-label">One DES key</span>
          <strong title={passphrase}>{passphrase || "…"}</strong>
          <code title={keyHex}>{keyHex || "…"}</code>
          <div className="des-key-bar" role="img" aria-label="64-bit DES key: 56 effective bits and 8 parity bits">
            <div className="des-key-effective">
              <span>56 effective</span>
            </div>
            <div className="des-key-parity">
              <span>8 parity</span>
            </div>
          </div>
        </div>

        <div className="des-how-key-fanout" role="group" aria-label="The same key feeds every message block">
          <span className="des-how-key-source">same K</span>
          <span className="des-how-fan-line" aria-hidden="true">→</span>
          <div className="des-how-key-targets">
            {blocks.map((_, index) => (
              <span key={`key-target-${index}`}>Encrypt block {index + 1}</span>
            ))}
          </div>
        </div>

        <p className="caption">
          Inside each operation, DES derives 16 round keys from this one key and runs 16 Feistel
          rounds. The Feistel Advanced section below lets you inspect those mechanics.
        </p>
      </article>

      <article className="tdes-section">
        <h3 className="tdes-section-title">Encrypt and decrypt mirror each other</h3>
        <div className="des-how-mirror" role="group" aria-label="Mirrored DES encryption and decryption">
          <div className="des-how-path">
            <strong>Encrypt ↓</strong>
            <Endpoint label="Plaintext block" detail="64 bits · start" />
            <span className="des-how-down" aria-hidden="true">↓</span>
            <DesOperation operation="Encrypt" keyLabel="with K" />
            <span className="des-how-down" aria-hidden="true">↓</span>
            <Endpoint label="Ciphertext block" detail="64 bits · end" />
          </div>
          <div className="des-how-path">
            <strong>Decrypt ↑</strong>
            <Endpoint label="Plaintext block" detail="64 bits · end" />
            <span className="des-how-down" aria-hidden="true">↑</span>
            <DesOperation operation="Decrypt" keyLabel="with the same K" />
            <span className="des-how-down" aria-hidden="true">↑</span>
            <Endpoint label="Ciphertext block" detail="64 bits · start" />
          </div>
        </div>
        <p className="caption">
          <strong>Decrypt applies the inverse DES operation with the same key.</strong> It walks the
          block back from ciphertext to plaintext.
        </p>
      </article>

      <article className="tdes-section">
        <h3 className="tdes-section-title">CBC links blocks; it does not create more DES operations</h3>
        <p className="caption">
          Before DES encrypts a block, CBC mixes it with the previous ciphertext block. Block 1
          starts from the IV. This teaching demo shows a zero IV: <code>0000000000000000</code>.
        </p>
        <div className="des-how-cbc" aria-label="CBC links blocks before each DES operation">
          <span>IV</span>
          <span aria-hidden="true">→</span>
          {blocks.map((_, index) => (
            <span key={`cbc-${index}`}>Block {index + 1} + DES(K)</span>
          ))}
        </div>
      </article>

      <article className="tdes-section">
        <h3 className="tdes-section-title">Why we show Base64</h3>
        <p className="caption">
          Base64 is not part of encryption. Ciphertext is raw bytes; Base64 only packages those bytes
          as printable text for transport — for example so binary data and awkward empty spaces can
          travel safely as characters. Anyone can unwrap Base64; the key still protects the message.
        </p>
        <div className="tdes-b64-flow" aria-label="Base64 follows DES encryption">
          <span className="tdes-b64-step">DES</span>
          <span className="tdes-ops-arrow" aria-hidden="true">→</span>
          <span className="tdes-b64-step">ciphertext bytes</span>
          <span className="tdes-ops-arrow" aria-hidden="true">→</span>
          <span className="tdes-b64-step b64">Base64</span>
          <span className="tdes-ops-arrow" aria-hidden="true">→</span>
          <span className="tdes-b64-step">text on screen</span>
        </div>
        <div className="tdes-run" aria-label="Values from the DES demo above">
          <span className="tdes-run-label">You typed</span>
          <code className="tdes-run-value" title={plaintext}>{plaintext || "…"}</code>
          <span className="tdes-run-label">Ciphertext, in Base64</span>
          <code className="tdes-run-value" title={cipherB64}>{cipherB64 || "…"}</code>
          <span className="tdes-run-label">Decrypted back</span>
          <code className="tdes-run-value" title={recovered}>{recovered || "…"}</code>
        </div>
        {!cipherB64 ? (
          <p className="caption tdes-live-note">Press Encrypt in the demo above to fill these in.</p>
        ) : null}
      </article>

      <p className="tdes-mental-model">
        Split into 64-bit blocks. Run DES once per block with the same key. Reverse the operation to
        decrypt.
      </p>
    </section>
  );
}
