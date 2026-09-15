/** Inline SVG stage icons — no emoji, projector-friendly. */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function IconNegotiation({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      {/* Two parties offering checklist chips */}
      <circle cx="8" cy="12" r="4" {...stroke} />
      <circle cx="24" cy="12" r="4" {...stroke} />
      <path d="M12 12h8" {...stroke} />
      <rect x="6" y="20" width="8" height="6" rx="1" {...stroke} />
      <rect x="18" y="20" width="8" height="6" rx="1" {...stroke} />
      <path d="M8 22.5h4M20 22.5h4" {...stroke} />
    </svg>
  );
}

export function IconMutualAuth({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      {/* Badge ↔ badge */}
      <path d="M8 6l4 2v5c0 3-2 5-4 6-2-1-4-3-4-6V8l4-2z" {...stroke} />
      <path d="M24 6l4 2v5c0 3-2 5-4 6-2-1-4-3-4-6V8l4-2z" {...stroke} />
      <path d="M12 14h8M14 16l2 2 4-4" {...stroke} />
    </svg>
  );
}

export function IconKeyExchange({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      {/* Two half-keys meeting in the middle */}
      <circle cx="7" cy="16" r="4" {...stroke} />
      <path d="M11 16h5M14 13v6" {...stroke} />
      <circle cx="25" cy="16" r="4" {...stroke} />
      <path d="M21 16h-5M18 13v6" {...stroke} />
      <path d="M15 10v-2M17 10v-2M15 24v2M17 24v2" {...stroke} />
    </svg>
  );
}

export function IconOngoing({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      {/* Locked envelope + check */}
      <rect x="4" y="10" width="18" height="14" rx="1.5" {...stroke} />
      <path d="M4 12l9 6 9-6" {...stroke} />
      <path d="M24 8v4h4" {...stroke} />
      <circle cx="26" cy="8" r="3.5" {...stroke} />
      <path d="M24.5 8l1.2 1.2 2.3-2.4" {...stroke} />
    </svg>
  );
}

export function IconSignatures({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      {/* Document + wax seal */}
      <path d="M8 4h10l6 6v16H8V4z" {...stroke} />
      <path d="M18 4v6h6" {...stroke} />
      <path d="M11 14h8M11 18h6" {...stroke} />
      <circle cx="22" cy="24" r="5" {...stroke} />
      <path d="M20 24l1.5 1.5 3-3" {...stroke} />
    </svg>
  );
}

export function IconCertificates({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M8 4h10l6 6v16H8V4z" {...stroke} />
      <path d="M18 4v6h6" {...stroke} />
      <path d="M11 14h8M11 18h5" {...stroke} />
      <circle cx="20" cy="23" r="4" {...stroke} />
      <path d="M18.5 23l1.2 1.2 2.3-2.4" {...stroke} />
    </svg>
  );
}

export function IconLiveCertificate({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="11" {...stroke} />
      <path d="M5 16h22M16 5c4 4 5 8 5 11s-1 7-5 11c-4-4-5-8-5-11s1-7 5-11z" {...stroke} />
      <path d="M21 22l2 2 4-5" {...stroke} />
    </svg>
  );
}

export function IconValidity({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="5" y="8" width="22" height="18" rx="2" {...stroke} />
      <path d="M5 13h22M11 8V5M21 8V5" {...stroke} />
      <path d="M10 18h4M16 18h6" {...stroke} />
      <circle cx="24" cy="22" r="3" {...stroke} />
    </svg>
  );
}

export function IconHmacLab({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="9" cy="16" r="4" {...stroke} />
      <path d="M13 16h6" {...stroke} />
      <rect x="18" y="10" width="9" height="12" rx="1.5" {...stroke} />
      <path d="M20.5 14h4M20.5 18h4M20.5 22h2.5" {...stroke} />
    </svg>
  );
}

export function IconNonRepudiation({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="8" width="11" height="16" rx="1.5" {...stroke} />
      <rect x="18" y="8" width="11" height="16" rx="1.5" {...stroke} />
      <path d="M6 14h5M6 18h3" {...stroke} />
      <circle cx="23.5" cy="16" r="3" {...stroke} />
      <path d="M22 16l1.2 1.2 2-2.2" {...stroke} />
    </svg>
  );
}

const ICONS = {
  negotiation: IconNegotiation,
  "mutual-auth": IconMutualAuth,
  "key-exchange": IconKeyExchange,
  ongoing: IconOngoing,
  signatures: IconSignatures,
  certificates: IconCertificates,
  "live-certificate": IconLiveCertificate,
  validity: IconValidity,
  "hmac-lab": IconHmacLab,
  "non-repudiation": IconNonRepudiation,
};

export function StageIcon({ id, className = "stage-icon" }) {
  const Cmp = ICONS[id];
  if (!Cmp) return null;
  return <Cmp className={className} />;
}

/** Large illustrative panel for the active Part 6 sub-page. */
export function StageHero({ subId, signed = false, verifyOk = null, tamperOk = null }) {
  if (subId === "negotiation") {
    return (
      <div className="stage-hero" aria-hidden="true">
        <div className="stage-hero-flow">
          <div className="stage-node">
            <span className="stage-node-label">Alice</span>
            <ul className="stage-chips">
              <li>DH</li>
              <li>RSA</li>
              <li>AES</li>
            </ul>
          </div>
          <div className="stage-arrow" aria-hidden="true">
            ↔
          </div>
          <div className="stage-node">
            <span className="stage-node-label">Bob</span>
            <ul className="stage-chips">
              <li className="picked">DH+RSA</li>
              <li className="picked">AES</li>
            </ul>
          </div>
        </div>
        <p className="stage-hero-caption">Agree one cipher suite</p>
      </div>
    );
  }

  if (subId === "mutual-auth") {
    return (
      <div className="stage-hero" aria-hidden="true">
        <div className="stage-hero-flow stage-auth-flow">
          <div className="stage-badge">
            <IconMutualAuth className="stage-icon-lg" />
            <span>Alice proves ID</span>
          </div>
          <div className="stage-arrows-col">
            <span>sign →</span>
            <span>← sign</span>
          </div>
          <div className="stage-badge">
            <IconMutualAuth className="stage-icon-lg" />
            <span>Bob proves ID</span>
          </div>
        </div>
        <p className="stage-hero-caption">Both sides verify — mutual authentication</p>
      </div>
    );
  }

  if (subId === "key-exchange") {
    return (
      <div className="stage-hero" aria-hidden="true">
        <div className="stage-hero-flow stage-key-flow">
          <div className="stage-key-half">
            <span>Alice secret</span>
            <div className="key-bit left" />
          </div>
          <div className="stage-key-mid">
            <IconKeyExchange className="stage-icon-lg" />
            <span className="shared-glow">shared secret</span>
          </div>
          <div className="stage-key-half">
            <span>Bob secret</span>
            <div className="key-bit right" />
          </div>
        </div>
        <p className="stage-hero-caption">Public values travel · secret stays private → session key</p>
      </div>
    );
  }

  if (subId === "ongoing") {
    return (
      <div className="stage-hero" aria-hidden="true">
        <div className="stage-hero-flow stage-msg-flow">
          <div className="msg-pipe">
            <span className="msg-bubble">Hi</span>
            <span className="msg-icon-wrap" title="Confidentiality">
              <svg viewBox="0 0 24 24" className="msg-mini-icon" aria-hidden="true">
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
            </span>
            <span className="msg-tag" title="Auth + integrity">
              ✓ tag
            </span>
            <span className="msg-bubble locked">····</span>
          </div>
        </div>
        <p className="stage-hero-caption">Each message: encrypt · authenticate · integrity check</p>
      </div>
    );
  }

  if (subId === "signatures") {
    return (
      <div className="stage-hero stage-sig-hero" aria-hidden="true">
        <div className="sig-story">
          <div className={`sig-doc ${signed ? "sealed" : ""}`}>
            <div className="sig-lines" />
            <div className={`sig-seal ${signed ? "on" : ""}`}>
              <span className="sig-seal-inner">SEAL</span>
            </div>
          </div>
          <div className="sig-steps">
            <div className="sig-step">
              <span className="sig-key priv">private</span>
              <span>stamps the seal</span>
            </div>
            <div className="sig-step">
              <span className="sig-key pub">public</span>
              <span>checks the seal</span>
            </div>
            <div className="sig-verdicts">
              <span className={verifyOk === true ? "ok" : verifyOk === false ? "bad" : ""}>
                Original {verifyOk == null ? "—" : verifyOk ? "valid" : "invalid"}
              </span>
              <span className={tamperOk === false ? "ok" : tamperOk === true ? "bad" : ""}>
                Tampered {tamperOk == null ? "—" : tamperOk ? "still valid?!" : "invalid"}
              </span>
            </div>
          </div>
        </div>
        <p className="stage-hero-caption">
          Like a wax seal on a letter — anyone can check it; only the owner can make it
        </p>
      </div>
    );
  }

  return null;
}
