import { useEffect, useState } from "react";
import {
  exportRsaPrivatePem,
  exportRsaPublicPem,
  generateRsaOaepPair,
  rsaDecryptPrivate,
  rsaEncryptPublic,
} from "../lib/sessionCrypto.js";
import { PLAINTEXT_MAX } from "../lib/format.js";
import CollapsibleBand from "./CollapsibleBand.jsx";

/** Optional RSA key-wrap band for Part 6.3 — same CollapsibleBand shell as Real world. */
export default function RsaWrapOptional({ plaintext, setPlaintext }) {
  const safe = plaintext.slice(0, PLAINTEXT_MAX);
  const [rsaPair, setRsaPair] = useState(null);
  const [publicPem, setPublicPem] = useState("");
  const [privatePem, setPrivatePem] = useState("");
  const [rsaCipherB64, setRsaCipherB64] = useState("");
  const [rsaRecovered, setRsaRecovered] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | locked | unlocked
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState(null); // gen | lock | unlock
  const [error, setError] = useState("");

  async function loadBobKeys() {
    setBusy(true);
    setAction("gen");
    setError("");
    setRsaCipherB64("");
    setRsaRecovered("");
    setPhase("idle");
    try {
      const pair = await generateRsaOaepPair();
      const [pub, priv] = await Promise.all([
        exportRsaPublicPem(pair.publicKey),
        exportRsaPrivatePem(pair.privateKey),
      ]);
      setRsaPair(pair);
      setPublicPem(pub);
      setPrivatePem(priv);
    } catch (err) {
      setError(err.message || String(err));
      setRsaPair(null);
      setPublicPem("");
      setPrivatePem("");
    } finally {
      setBusy(false);
      setAction(null);
    }
  }

  useEffect(() => {
    void loadBobKeys();
  }, []);

  async function lockWithPublic() {
    if (!rsaPair) return;
    setBusy(true);
    setAction("lock");
    setError("");
    setRsaRecovered("");
    try {
      const secret = safe.slice(0, 32) || "AES-KEY-DEMO";
      const ct = await rsaEncryptPublic(rsaPair.publicKey, secret);
      setRsaCipherB64(ct);
      setPhase("locked");
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
      setAction(null);
    }
  }

  async function unlockWithPrivate() {
    if (!rsaPair || !rsaCipherB64) return;
    setBusy(true);
    setAction("unlock");
    setError("");
    try {
      const pt = await rsaDecryptPrivate(rsaPair.privateKey, rsaCipherB64);
      setRsaRecovered(pt);
      setPhase("unlocked");
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
      setAction(null);
    }
  }

  const secretLabel = safe || "AES-KEY-DEMO";

  return (
    <CollapsibleBand
      title="Optional: RSA wrap"
      note="Skip if Diffie–Hellman already gave you a session key. Teaching keys only — not for production."
      defaultOpen
      className="real-world rsa-wrap-band"
    >
      <div className="rw-sections">
        <div className="rw-section">
          <p className="caption">
            Alice locks a <strong>tiny</strong> AES key with <strong>Bob’s real public key</strong>.
            Only Bob’s private key unlocks it. The long message still goes through AES.
          </p>
        </div>

        <div className="rw-section">
          <h3>Bob’s key pair</h3>
          <p className="caption">
            Fresh RSA-OAEP 2048-bit pair for this demo. Public is safe to share; private is shown for
            class only.
          </p>
          <div className="hs-rsa-keys">
            <div className="hs-rsa-key-card">
              <h4>Bob’s public key</h4>
              <p className="caption">Alice uses this to lock.</p>
              <pre className="hs-rsa-pem">{publicPem || "Generating…"}</pre>
            </div>
            <div className="hs-rsa-key-card hs-rsa-key-private">
              <h4>Bob’s private key</h4>
              <p className="caption">In real life this never leaves Bob’s machine.</p>
              <pre className="hs-rsa-pem">{privatePem || "Generating…"}</pre>
            </div>
          </div>
          <div className="demo-actions">
            <button type="button" disabled={busy} onClick={loadBobKeys}>
              {action === "gen" ? "Generating…" : "Generate new Bob key pair"}
            </button>
          </div>
        </div>

        <div className="rw-section">
          <h3>Lock / unlock</h3>
          <figure className="hs-rsa-diagram">
            <figcaption>RSA lock / unlock</figcaption>
            <div className="hs-rsa-flow" aria-hidden="true">
              <div className={`hs-rsa-node ${phase === "idle" ? "active" : ""}`}>
                <span className="hs-rsa-who">Alice</span>
                <div className="hs-rsa-box keyish">{secretLabel}</div>
              </div>
              <div
                className={`hs-rsa-arrow ${phase === "locked" || phase === "unlocked" ? "active" : ""}`}
              >
                <span>Encrypt w/ Bob’s public key</span>
                <div className="hs-rsa-arrow-line" />
                <svg className="hs-rsa-lock-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <rect
                    x="5"
                    y="11"
                    width="14"
                    height="10"
                    rx="1.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                  />
                  <path
                    d="M8 11V8a4 4 0 0 1 8 0v3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                  />
                </svg>
              </div>
              <div className={`hs-rsa-node ${phase === "locked" ? "active" : ""}`}>
                <span className="hs-rsa-who">On the wire</span>
                <div className="hs-rsa-box locked">
                  {rsaCipherB64 ? "wrapped key ···" : "wrapped key"}
                </div>
              </div>
              <div className={`hs-rsa-arrow ${phase === "unlocked" ? "active" : ""}`}>
                <span>Decrypt w/ Bob’s private key</span>
                <div className="hs-rsa-arrow-line" />
                <svg className="hs-rsa-lock-icon open" viewBox="0 0 24 24" aria-hidden="true">
                  <rect
                    x="5"
                    y="11"
                    width="14"
                    height="10"
                    rx="1.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                  />
                  <path
                    d="M8 11V7a4 4 0 0 1 7.5-2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                  />
                </svg>
              </div>
              <div className={`hs-rsa-node ${phase === "unlocked" ? "active" : ""}`}>
                <span className="hs-rsa-who">Bob</span>
                <div className="hs-rsa-box keyish">{rsaRecovered || "tiny AES key"}</div>
              </div>
            </div>
          </figure>

          <label className="field">
            <span>Tiny secret to wrap (≤32 chars)</span>
            <input
              value={safe}
              maxLength={PLAINTEXT_MAX}
              onChange={(e) => {
                setPlaintext(e.target.value.slice(0, PLAINTEXT_MAX));
                setRsaCipherB64("");
                setRsaRecovered("");
                setPhase("idle");
              }}
            />
          </label>
          <div className="demo-actions">
            <button
              type="button"
              className="primary"
              disabled={busy || !rsaPair}
              onClick={lockWithPublic}
            >
              {action === "lock" ? "Locking…" : "Lock with Bob’s public key"}
            </button>
            <button
              type="button"
              disabled={busy || !rsaPair || !rsaCipherB64}
              onClick={unlockWithPrivate}
            >
              {action === "unlock" ? "Unlocking…" : "Unlock with Bob’s private key"}
            </button>
          </div>
          {rsaCipherB64 ? (
            <div className={`hs-kx-result ${phase === "unlocked" ? "ok" : ""}`}>
              <div className="hs-kx-result-row">
                <span className="hs-kx-result-label">Wrapped (Base64)</span>
                <code className="hs-break hs-kx-result-key">{rsaCipherB64}</code>
              </div>
              {phase === "unlocked" ? (
                <div className="hs-kx-result-row">
                  <span className="hs-kx-result-label">Unlocked</span>
                  <code>{rsaRecovered}</code>
                </div>
              ) : (
                <p className="hs-kx-result-note">
                  Locked with Bob’s public key. Next: unlock with his private key.
                </p>
              )}
            </div>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
        </div>
      </div>
    </CollapsibleBand>
  );
}
