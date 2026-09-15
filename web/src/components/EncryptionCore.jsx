const CORE = [
  {
    id: "plaintext",
    title: "Plaintext",
    gloss: "the original message",
    nested: ["Text", "File", "Image", "etc."],
  },
  {
    id: "key",
    title: "Key",
    gloss: "the secret input",
    nested: ["Passphrase", "Shared secret", "Public / private key", "etc."],
  },
  {
    id: "cipher",
    title: "Cipher / Algorithm",
    gloss: "the rules for transforming the message",
    nested: ["RC4", "DES", "3DES", "AES", "etc."],
  },
  {
    id: "transforms",
    title: "Transformations",
    gloss: "the operations used by the algorithm",
    nested: ["Permutation", "Substitution", "XOR", "etc."],
  },
  {
    id: "mode",
    title: "Mode",
    gloss: "how the cipher handles a whole message (many blocks)",
    nested: ["ECB", "CBC", "etc."],
  },
  {
    id: "ciphertext",
    title: "Ciphertext",
    gloss: "the transformed message",
  },
  {
    id: "decrypt",
    title: "Decryption",
    gloss: "reversing the transformation using the key",
  },
];

/** Teaching strip: core encryption pieces, left → right. */
export default function EncryptionCore() {
  return (
    <section className="encryption-core" aria-labelledby="encryption-core-heading">
      <header className="encryption-core-header">
        <h2 id="encryption-core-heading">Core Components Of Encryption</h2>
      </header>

      <ol className="encryption-core-row">
        {CORE.map((item, i) => (
          <li key={item.id} className="encryption-core-item">
            {i > 0 ? (
              <span className="encryption-core-arrow" aria-hidden="true">
                →
              </span>
            ) : null}
            <article className="encryption-core-card">
              <h3 className="encryption-core-title">{item.title}</h3>
              <p className="encryption-core-gloss">{item.gloss}</p>
              {item.nested ? (
                <ul className="encryption-core-nested">
                  {item.nested.map((op) => (
                    <li key={op}>{op}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
