import { useEffect, useMemo } from "react";
import { decodeBase64, encodeBase64, md5Hex, toyEncrypt } from "../lib/ciphers.js";
import { PLAINTEXT_MAX } from "../lib/format.js";

const DEFAULT = "HELLO WORLD";

export default function FoundationsDemo({ plaintext, setPlaintext, onRealWorldChange }) {
  const safe = plaintext.slice(0, PLAINTEXT_MAX);
  const ciphertext = useMemo(() => toyEncrypt(safe), [safe]);
  const b64 = useMemo(() => encodeBase64(safe), [safe]);
  const hash = useMemo(() => md5Hex(safe), [safe]);
  const decoded = useMemo(() => {
    try {
      return decodeBase64(b64);
    } catch {
      return "(decode failed)";
    }
  }, [b64]);

  useEffect(() => {
    const escaped = safe.replace(/'/g, `'\\''`);
    onRealWorldChange?.([
      {
        id: "b64-encode",
        title: "Base64 encoding",
        caption: "Same bytes, different representation. Reversible. No key.",
        commandText: `printf '${escaped}' | openssl enc -base64 -e`,
        runBody: { part: "foundations", variant: "b64-encode", plaintext: safe },
        applications: [
          "Email attachments (MIME)",
          "Embedding binary data in JSON or URLs",
          "Data URIs in web pages",
          "Shipping binary through text-only channels",
        ],
      },
      {
        id: "md5",
        title: "Hash MD5",
        caption: "Digest fingerprint. Change one letter → new digest. Not reversible. Broken for integrity.",
        commandText: `printf '${escaped}' | openssl dgst -md5`,
        runBody: { part: "foundations", variant: "md5", plaintext: safe },
        applications: [
          "File integrity checks and checksums",
          "Digital signatures (hash-then-sign)",
          "Password storage (with salt — never raw)",
          "Git commit identifiers",
        ],
      },
    ]);
  }, [safe, onRealWorldChange]);

  return (
    <div className="foundations-demo">
      <div className="term-stack" aria-label="Plaintext, cipher, and ciphertext">
        <section className="term-block term-plaintext">
          <header className="term-header">
            <h3>Plaintext</h3>
          </header>
          <p className="caption">Readable message — no key needed to understand it.</p>
          <label className="field">
            <span className="sr-only">Edit plaintext</span>
            <input
              type="text"
              value={safe}
              maxLength={PLAINTEXT_MAX}
              onChange={(e) => setPlaintext(e.target.value.slice(0, PLAINTEXT_MAX))}
              aria-label="Plaintext"
            />
          </label>
          <p className="hint">Max {PLAINTEXT_MAX} characters. Change a letter and watch what follows.</p>
        </section>

        <div className="term-arrow" aria-hidden="true">
          ↓
        </div>

        <section className="term-block term-cipher">
          <header className="term-header">
            <h3>Cipher</h3>
          </header>
          <p className="caption">
            A mathematical process for encryption and decryption. This demo uses a toy only —
            substitution (A→N) then transposition (reverse every 4 characters).
          </p>
          <ol className="cipher-steps">
            <li>
              <strong>Substitution</strong> — replace letters (Caesar +13)
            </li>
            <li>
              <strong>Transposition</strong> — reorder chunks
            </li>
          </ol>
          <p className="caption">Ideas inside many real ciphers — then stop. Not a production algorithm.</p>
        </section>

        <div className="term-arrow" aria-hidden="true">
          ↓
        </div>

        <section className="term-block term-ciphertext">
          <header className="term-header">
            <h3>Ciphertext</h3>
          </header>
          <p className="caption">
            Output of the cipher. With a real cipher, this should be useless without the key.
          </p>
          <pre className="output">{ciphertext || "(empty)"}</pre>
        </section>
      </div>

      <div className="outcome-grid">
        <article className="outcome-with-apps">
          <div className="outcome-main">
            <h3>Not encryption — Encoding (Base64)</h3>
            <p className="caption">Same bytes, different look. No key. Reversible. Not Confidentiality.</p>
            <pre className="output">{b64}</pre>
            <p className="caption">Decode (no key): {decoded}</p>
          </div>
          <aside className="outcome-apps">
            <h4>Applications of encoding</h4>
            <ul>
              <li>Email attachments (MIME)</li>
              <li>Embedding binary data in JSON or URLs</li>
              <li>Data URIs in web pages</li>
              <li>Shipping binary through text-only channels</li>
            </ul>
          </aside>
        </article>
        <article className="outcome-with-apps">
          <div className="outcome-main">
            <h3>Not encryption — Hash MD5</h3>
            <p className="caption">
              Fingerprint of the plaintext. Change one letter → new digest. No key. Not reversible.
            </p>
            <pre className="output mono">{hash || "…"}</pre>
            <span className="chip">MD5 / SHA-1: broken for integrity — prefer SHA-256</span>
          </div>
          <aside className="outcome-apps">
            <h4>Applications of hashing</h4>
            <ul>
              <li>File integrity checks and checksums</li>
              <li>Digital signatures (hash-then-sign)</li>
              <li>Password storage (with salt — never raw)</li>
              <li>Git commit identifiers</li>
            </ul>
          </aside>
        </article>
      </div>

      <div className="contrast">
        <h3>Three-way contrast</h3>
        <div className="contrast-cards" role="list">
          <article className="contrast-card" role="listitem">
            <h4>Encode</h4>
            <p className="contrast-property">Reversible, no secret</p>
            <p className="contrast-cia contrast-cia-no">Not Confidentiality</p>
          </article>
          <article className="contrast-card contrast-card-encrypt" role="listitem">
            <h4>Encrypt</h4>
            <p className="contrast-property">Reversible with the key</p>
            <p className="contrast-cia contrast-cia-yes">Confidentiality</p>
          </article>
          <article className="contrast-card" role="listitem">
            <h4>Hash</h4>
            <p className="contrast-property">Not reversible</p>
            <p className="contrast-cia contrast-cia-mix">
              Integrity (detect change)
              <span>Not Confidentiality</span>
            </p>
          </article>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT as FOUNDATIONS_DEFAULT_PLAINTEXT };
