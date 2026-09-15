import { useEffect, useState } from "react";
import { PLAINTEXT_MAX } from "../lib/format.js";
import { hmacSha256Hex } from "../lib/sessionCrypto.js";
import { runOpenSSL } from "../lib/api.js";
import { FOUNDATIONS_DEFAULT_PLAINTEXT } from "./FoundationsDemo.jsx";
import fields from "../fixtures/google-leaf-fields.json";

const DEFAULT_HMAC_KEY = "classroom-secret";

const FIELD_BLURBS = [
  ["Version number", "X.509 version of this cert format"],
  ["Serial number", "Unique ID assigned by the issuer"],
  ["Signature algorithm ID", "Algorithm the CA used to sign this cert"],
  ["Issuer name", "Who issued (the CA)"],
  ["Validity period", "NotBefore / NotAfter window"],
  ["Subject name", "Whose identity is bound"],
  ["Public key algorithm", "Algorithm of the subject’s key"],
  ["Subject public key", "The public key being certified"],
  ["Other optional fields", "Extensions / extras (optional — not a full extension browser)"],
  ["Certificate signature algorithm", "Algorithm ID carried with the signature over the cert"],
  ["Certificate signature", "CA’s signature bytes binding the fields"],
];

const CERT_STEPS = [
  {
    id: 1,
    title: "CA checks identity",
    body: "Prove you control the name before anyone vouches for your key.",
  },
  {
    id: 2,
    title: "CA signs certificate",
    body: "One signature binds identity + public key + dates together.",
  },
  {
    id: 3,
    title: "Browser trusts key",
    body: "A CA public key you already hold decides pass or stop.",
  },
];

// 7.1 Real world: a local toy CA + leaf, walking the same three moments as the storyboard
// (check identity → sign → verify). Every Run rebuilds the files it needs in the container,
// so the steps can be run in any order. Outbound TLS stays on 7.2.
const TOY_CA_COMMANDS = [
  {
    id: "trust-toy-ca-gen",
    title: "1. Generate the classroom CA",
    caption:
      "Classroom toy only — a self-signed root no browser trusts. Run prints ca.crt; the CA private key stays in the container.",
    commandText:
      'openssl req -x509 -newkey rsa:2048 -noenc -keyout ca.key -days 365 \\\n  -subj "/CN=Crypto Visualizer Classroom CA" -out ca.crt',
    runBody: { part: "trust", variant: "toy-ca-gen", plaintext: "toy-ca" },
  },
  {
    id: "trust-toy-csr-subject",
    title: "2. Check the claimed identity",
    caption:
      "The subject asks for a name in a CSR. This is the “CA looks at who you claim to be” moment — a real CA would then demand proof of control.",
    commandText:
      'openssl genrsa -out leaf.key 2048\nopenssl req -new -key leaf.key -subj "/CN=alice.example" -out leaf.csr\nopenssl req -in leaf.csr -noout -subject -verify',
    runBody: { part: "trust", variant: "toy-csr-subject", plaintext: "toy-ca" },
  },
  {
    id: "trust-toy-ca-sign",
    title: "3. CA signs the certificate",
    caption:
      "One CA signature binds identity + public key + dates. Run prints the signed leaf certificate.",
    commandText:
      "openssl x509 -req -in leaf.csr -CA ca.crt -CAkey ca.key -CAcreateserial \\\n  -days 365 -sha256 -out leaf.crt",
    runBody: { part: "trust", variant: "toy-ca-sign", plaintext: "toy-ca" },
  },
  {
    id: "trust-toy-chain-verify",
    title: "4. Validate against the CA",
    caption:
      "The verifier already holds ca.crt and checks the signature on leaf.crt. “OK” is the pass in storyboard step 3; drop the -CAfile and it fails.",
    commandText: "openssl verify -CAfile ca.crt leaf.crt",
    runBody: { part: "trust", variant: "toy-chain-verify", plaintext: "toy-ca" },
  },
  {
    id: "trust-toy-leaf-fields",
    title: "5. Read the signed certificate",
    caption:
      "Issuer is the toy CA, subject is the name from step 2 — the same fields as the table on the left. Full field dump on a real cert is 7.2.",
    commandText: "openssl x509 -in leaf.crt -noout -subject -issuer -dates -serial",
    runBody: { part: "trust", variant: "toy-leaf-fields", plaintext: "toy-ca" },
  },
];

const REVOKE_COMMANDS = [
  {
    id: "trust-revoke-setup",
    title: "1. Build a toy CA + leaf",
    caption:
      "Canned setup creates ca.pem, leaf.pem, and the tiny CA database used by every step. Each Run rebuilds this workspace from scratch, so the leaf always gets serial 1000 — the steps below still tell one story.",
    commandText:
      'openssl req -x509 -newkey rsa:2048 -noenc -subj "/CN=Crypto Visualizer Classroom CA" -keyout ca.key -out ca.pem\nopenssl genrsa -out leaf.key 2048\nopenssl req -new -key leaf.key -subj "/CN=alice.example" -out leaf.csr\nopenssl ca -batch -config openssl.cnf -in leaf.csr -out leaf.pem -notext',
    runBody: { part: "trust", variant: "revoke-setup", plaintext: "revoke" },
  },
  {
    id: "trust-revoke-before",
    title: "2. Verify before revocation",
    caption: "The CA signature is trusted and the leaf is not revoked yet, so verification succeeds.",
    commandText: "openssl verify -CAfile ca.pem leaf.pem",
    runBody: { part: "trust", variant: "revoke-verify-before", plaintext: "revoke" },
  },
  {
    id: "trust-revoke-leaf",
    title: "3. Revoke the leaf",
    caption:
      "The CA records this leaf’s serial number as revoked in its local database — “Revoking Certificate 1000” is the serial from step 1.",
    commandText: "openssl ca -batch -config openssl.cnf -revoke leaf.pem",
    runBody: { part: "trust", variant: "revoke-leaf", plaintext: "revoke" },
  },
  {
    id: "trust-revoke-crl",
    title: "4. Generate and inspect the CRL",
    caption:
      "Run repeats step 3 in the background first, so the generated list already contains the revoked leaf serial number.",
    commandText: "openssl ca -batch -config openssl.cnf -gencrl -out crl.pem\nopenssl crl -in crl.pem -text -noout",
    runBody: { part: "trust", variant: "revoke-show-crl", plaintext: "revoke" },
  },
  {
    id: "trust-revoke-after",
    title: "5. Verify with revocation checking",
    caption:
      "Expected failure: the dates and signature still pass, but -crl_check finds certificate revoked. Run rebuilds the same CA, revokes serial 1000, and regenerates crl.pem before this command.",
    commandText: "openssl verify -CAfile ca.pem -CRLfile crl.pem -crl_check leaf.pem",
    runBody: { part: "trust", variant: "revoke-verify-after", plaintext: "revoke" },
  },
];

const VALIDITY_STEPS = [
  { id: 1, title: "Certificate dates", body: "Read the certificate’s NotBefore and NotAfter bounds." },
  { id: 2, title: "Within the window", body: "Now falls between both dates, so the date check passes." },
  { id: 3, title: "CA revokes", body: "A compromised key or changed identity makes the certificate unsafe early." },
  { id: 4, title: "Status check fails", body: "The dates still pass, but revocation changes the trust decision to reject." },
];

const HMAC_STEPS = [
  { id: 1, title: "Sender inputs", body: "Supplicant starts with the HMAC key and original plaintext side by side." },
  { id: 2, title: "Hash", body: "HMAC-SHA-256 combines the shared key and message. This authenticates; it does not encrypt." },
  { id: 3, title: "Append", body: "Attach the transmitted HMAC to the plaintext: [plaintext ‖ HMAC]." },
  { id: 4, title: "Transmit", body: "Send the package. Transmission with confidentiality — those details are not shown here (see 6.4)." },
  { id: 5, title: "Receiver computes", body: "Verifier uses its copy of the key and the transmitted plaintext to compute a fresh HMAC." },
  { id: 6, title: "Compare", body: "Compare the transmitted HMAC with the computed HMAC." },
  {
    id: 7,
    title: "Decision",
    body: "Equal means authenticated. Any changed message or wrong key means reject.",
  },
];

function CertArrow({ label }) {
  return (
    <div className="cert-arrow" aria-hidden="true">
      <span className="cert-arrow-glyph">→</span>
      {label ? <span className="cert-arrow-label">{label}</span> : null}
    </div>
  );
}

function CertDiagram({ id }) {
  if (id === 1) {
    return (
      <div className="cert-flow" aria-hidden="true">
        <div className="cert-node who">
          Applicant
          <small>“I am example.com”</small>
        </div>
        <CertArrow label="asks" />
        <div className="cert-node ca">
          CA challenge
          <small>prove you control example.com</small>
        </div>
        <CertArrow />
        <div className="cert-branch">
          <div className="cert-node ok">✓ control proven</div>
          <div className="cert-node fail">✗ no certificate</div>
        </div>
      </div>
    );
  }
  if (id === 2) {
    return (
      <div className="cert-flow" aria-hidden="true">
        <div className="cert-node cert">
          Binding
          <small>example.com + public key + dates</small>
        </div>
        <span className="cert-join">+</span>
        <div className="cert-node priv">
          CA private key
          <small>hash-then-sign (6.5)</small>
        </div>
        <CertArrow label="signs" />
        <div className="cert-node signed">
          Certificate
          <small>binding + CA signature</small>
        </div>
      </div>
    );
  }
  return (
    <div className="cert-flow" aria-hidden="true">
      <div className="cert-node who">
        Browser / OS
        <small>already holds CA public key</small>
      </div>
      <span className="cert-join">+</span>
      <div className="cert-node signed">
        Certificate
        <small>binding + CA signature</small>
      </div>
      <CertArrow label="verify" />
      <div className="cert-branch">
        <div className="cert-node ok">✓ trust example.com’s public key</div>
        <div className="cert-node fail">✗ unknown key — stop</div>
      </div>
    </div>
  );
}

function CertificatesPanel() {
  const [step, setStep] = useState(1);
  const active = CERT_STEPS[step - 1];
  return (
    <section className="hs-panel">
      <h3>Certificates & certificate authorities</h3>
      <p className="caption">
        A certificate is a CA-signed binding of <strong>identity → public key</strong>.
      </p>
      <ol className="hs-auth-steps">
        {CERT_STEPS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={step === item.id ? "active" : ""}
              onClick={() => setStep(item.id)}
            >
              <span className="hs-auth-step-num">{item.id}</span>
              {item.title}
            </button>
          </li>
        ))}
      </ol>
      <div className="hs-auth-detail"><p>{active.body}</p></div>
      <div className="cert-fig">
        {CERT_STEPS.map((item) => (
          <div
            key={item.id}
            className={`cert-stage${step >= item.id ? " lit" : ""}${step === item.id ? " current" : ""}`}
          >
            <div className="cert-stage-head">
              <span className="cert-stage-num">{item.id}</span>
              {item.title}
            </div>
            <CertDiagram id={item.id} />
          </div>
        ))}
      </div>
      <div className="demo-actions">
        <button type="button" disabled={step === 1} onClick={() => setStep((n) => n - 1)}>Previous</button>
        <button type="button" disabled={step === CERT_STEPS.length} onClick={() => setStep((n) => n + 1)}>Next</button>
      </div>

      <h3>Certificate fields</h3>
      <table className="trust-field-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {FIELD_BLURBS.map(([name, desc]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function LiveCertificatePanel() {
  const [viewerFields, setViewerFields] = useState(fields.fields);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    runOpenSSL({ part: "trust", variant: "s_client-google", plaintext: "cert" })
      .then((response) => {
        if (cancelled) return;
        if (response.error || !response.certFields?.length) {
          setStatus("fallback");
          return;
        }
        setViewerFields(response.certFields);
        setStatus("live");
      })
      .catch(() => {
        if (!cancelled) setStatus("fallback");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="hs-panel">
      <h3>Live certificate — www.google.com</h3>
      <p className="caption">
        {status === "loading" ? "Fetching the current leaf certificate…" : null}
        {status === "live" ? "Live leaf fetched from www.google.com:443 in the app container." : null}
        {status === "fallback"
          ? "Using canned snapshot because live fetch failed."
          : null}
      </p>
      <div className="trust-cert-viewer">
        <div className="trust-browser-bar">
          <span className="trust-tls-mark" aria-hidden="true">TLS</span>
          <strong>https://www.google.com</strong>
          <span className={`trust-live-badge ${status}`}>{status === "live" ? "LIVE" : status === "loading" ? "FETCHING" : "SNAPSHOT"}</span>
        </div>
        <table className="trust-field-table">
          <tbody>
            {viewerFields.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td><code className="hmac-pipe">{row.value}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ValidityPanel() {
  const [step, setStep] = useState(1);
  const active = VALIDITY_STEPS[step - 1];
  const stageClass = (from, tone = "") =>
    `revoke-stage${step >= from ? " lit" : ""}${step === from ? " current" : ""}${tone ? ` ${tone}` : ""}`;

  return (
    <section className="hs-panel">
      <h3>Validity & revocation</h3>
      <ol className="hs-auth-steps">
        {VALIDITY_STEPS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={step === item.id ? "active" : ""}
              onClick={() => setStep(item.id)}
            >
              <span className="hs-auth-step-num">{item.id}</span>
              {item.title}
            </button>
          </li>
        ))}
      </ol>
      <div className="demo-actions hmac-nav">
        <button type="button" disabled={step === 1} onClick={() => setStep((n) => n - 1)}>
          Previous
        </button>
        <button
          type="button"
          disabled={step === VALIDITY_STEPS.length}
          onClick={() => setStep((n) => n + 1)}
        >
          Next
        </button>
        <button type="button" className="danger" onClick={() => setStep(1)}>
          Reset
        </button>
      </div>
      <div className="hs-auth-detail"><p>{active.body}</p></div>

      <div className="revoke-fig" aria-label="Certificate validity and revocation workflow">
        <section className={stageClass(1)}>
          <h4><span>1</span> Certificate validity window</h4>
          <div className="revoke-date-row">
            <div className="revoke-box date">
              NotBefore
              <small>{fields.notBefore}</small>
            </div>
            <div className="revoke-arrow" aria-hidden="true">→</div>
            <div className="revoke-box now">NOW</div>
            <div className="revoke-arrow" aria-hidden="true">→</div>
            <div className="revoke-box date">
              NotAfter
              <small>{fields.notAfter}</small>
            </div>
          </div>
        </section>

        <div className={`revoke-down-arrow${step >= 2 ? " lit" : ""}`} aria-hidden="true">↓</div>
        <section className={stageClass(2, "good")}>
          <h4><span>2</span> Date check</h4>
          <div className="revoke-flow-row">
            <div className="revoke-box cert">Certificate</div>
            <div className="revoke-arrow" aria-hidden="true">→</div>
            <div className="revoke-box valid">✓ WITHIN DATES</div>
          </div>
          <p>Looks valid — so far.</p>
        </section>

        <div className={`revoke-down-arrow danger${step >= 3 ? " lit" : ""}`} aria-hidden="true">↓</div>
        <section className={stageClass(3, "danger")}>
          <h4><span>3</span> CA revokes early</h4>
          <div className="revoke-flow-row">
            <div className="revoke-box ca">Certificate Authority</div>
            <div className="revoke-arrow" aria-hidden="true">→</div>
            <div className="revoke-box revoked">REVOKED</div>
          </div>
          <p>Compromised key or identity changed.</p>
        </section>

        <div className={`revoke-down-arrow danger${step >= 4 ? " lit" : ""}`} aria-hidden="true">↓</div>
        <section className={stageClass(4, "danger")}>
          <h4><span>4</span> Trust decision</h4>
          <div className="revoke-flow-row">
            <div className="revoke-box verifier">Verifier checks status</div>
            <div className="revoke-arrow" aria-hidden="true">→</div>
            <div className="revoke-box failed">✕ REJECT</div>
          </div>
          <p>Dates pass. Status does not.</p>
        </section>
      </div>
      <p className="caption">
        Real systems can check a <strong>CRL</strong> (Certificate Revocation List) or{" "}
        <strong>OCSP</strong> (Online Certificate Status Protocol). This figure is teach-only.
      </p>
    </section>
  );
}

function shortHex(hex) {
  if (!hex) return null;
  return `${hex.slice(0, 8)}…${hex.slice(-8)}`;
}

function FigureArrow({ lit, dual = false, label }) {
  const classes = ["hmac-arrow"];
  if (dual) classes.push("dual");
  if (lit) classes.push("lit");
  return (
    <div className={classes.join(" ")}>
      <span className="hmac-arrow-stem" aria-hidden="true" />
      <span className="hmac-arrow-label">{label}</span>
    </div>
  );
}

function HmacStepNav({ step, setStep, onReset, className }) {
  return (
    <div className={`demo-actions hmac-nav${className ? ` ${className}` : ""}`}>
      <button type="button" disabled={step === 1} onClick={() => setStep((n) => n - 1)}>
        Previous
      </button>
      <button
        type="button"
        disabled={step === HMAC_STEPS.length}
        onClick={() => setStep((n) => n + 1)}
      >
        Next
      </button>
      <button type="button" className="danger" onClick={onReset}>
        Reset
      </button>
    </div>
  );
}

function HmacLabPanel({ plaintext, setPlaintext, onRealWorldChange }) {
  const [step, setStep] = useState(1);
  const [keyText, setKeyText] = useState(DEFAULT_HMAC_KEY);
  const [tagHex, setTagHex] = useState("");
  const [verifyMsg, setVerifyMsg] = useState(plaintext);
  const [verifyKey, setVerifyKey] = useState(DEFAULT_HMAC_KEY);
  const [computedHex, setComputedHex] = useState("");
  const [result, setResult] = useState(null); // "ok" | "reject" | null
  const [busy, setBusy] = useState(false);
  const safe = plaintext.slice(0, PLAINTEXT_MAX);
  const rowClass = (from) => `hmac-row${step >= from ? " lit" : ""}`;

  useEffect(() => {
    onRealWorldChange?.([
      {
        id: "trust-hmac",
        title: "Tag the message with openssl dgst -sha256 -hmac",
        caption: "Message goes in on stdin; the key is the shared secret.",
        commandText: `printf '${safe.replace(/'/g, `'\\''`)}' | openssl dgst -sha256 -hmac '${keyText.replace(/'/g, `'\\''`)}'`,
        runBody: {
          part: "trust",
          variant: "hmac-sha256",
          plaintext: safe,
          passphrase: keyText,
        },
      },
    ]);
  }, [safe, keyText, onRealWorldChange]);

  async function onCreate() {
    setBusy(true);
    setResult(null);
    try {
      const hex = await hmacSha256Hex({ keyText, plaintext: safe });
      setTagHex(hex);
      setVerifyMsg(safe);
      setVerifyKey(keyText);
      setComputedHex("");
      setStep(3);
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    setBusy(true);
    try {
      const recomputed = await hmacSha256Hex({ keyText: verifyKey, plaintext: verifyMsg });
      setComputedHex(recomputed);
      const ok = Boolean(tagHex) && recomputed === tagHex;
      setResult(ok ? "ok" : "reject");
      setStep(7);
    } finally {
      setBusy(false);
    }
  }

  function onReset() {
    setStep(1);
    setKeyText(DEFAULT_HMAC_KEY);
    setPlaintext(FOUNDATIONS_DEFAULT_PLAINTEXT);
    setTagHex("");
    setVerifyMsg(FOUNDATIONS_DEFAULT_PLAINTEXT);
    setVerifyKey(DEFAULT_HMAC_KEY);
    setComputedHex("");
    setResult(null);
    setBusy(false);
  }

  return (
    <section className="hs-panel">
      <h3>HMAC lab — Figure 3-23</h3>
      <p className="caption">
        Live bytes are Web Crypto HMAC-SHA-256. Cartoon “adds key” is simplified — not
        key‖message-then-SHA.
      </p>
      <p className="caption">
        <strong>Note:</strong> HMAC key from negotiation ≠ bulk encryption key.
      </p>

      <ol className="hs-auth-steps">
        {HMAC_STEPS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={step === item.id ? "active" : ""}
              onClick={() => setStep(item.id)}
            >
              <span className="hs-auth-step-num">{item.id}</span>
              {item.title}
            </button>
          </li>
        ))}
      </ol>
      <HmacStepNav step={step} setStep={setStep} onReset={onReset} />

      <div className="hs-auth-detail"><p>{HMAC_STEPS[step - 1].body}</p></div>

      <div className="hmac-figure">
        <div className="hmac-region">
          <h4>Sender (Supplicant) Authentication Operations</h4>

          <div className={rowClass(1)}>
            <div className="hmac-box key">
              Key
              <small>{keyText || "—"}</small>
            </div>
            <span className="hmac-join" aria-hidden="true">+</span>
            <div className="hmac-box plain">
              Original Plaintext
              <small>{safe || "—"}</small>
            </div>
          </div>
          <p className="hmac-note">1. Adds key to original plaintext</p>

          <FigureArrow
            lit={step >= 2}
            label="2. Hashes combination with SHA-224, SHA-256, SHA-384, SHA-512, etc. (no encryption)"
          />

          <div className={rowClass(2)}>
            <div className="hmac-box mac">
              HMAC
              <small>{shortHex(tagHex) || "press Create HMAC"}</small>
            </div>
          </div>
          <p className="hmac-note">Key-hashed message authentication code (HMAC)</p>

          <FigureArrow lit={step >= 3} label="3. Appends HMAC to plaintext before transmission" />

          <div className={rowClass(3)}>
            <div className="hmac-box mac">
              HMAC
              <small>{shortHex(tagHex) || "—"}</small>
            </div>
            <div className="hmac-box plain">
              Original Plaintext
              <small>{safe || "—"}</small>
            </div>
          </div>

          <FigureArrow
            dual
            lit={step >= 4}
            label="4. Transmission with confidentiality (details not shown)"
          />
        </div>

        <div className="hmac-region">
          <h4>Receiver (Verifier) Operations for Authentication</h4>

          <div className={rowClass(5)}>
            <div className="hmac-box key">
              Key
              <small>{verifyKey || "—"}</small>
            </div>
            <span className="hmac-join" aria-hidden="true">+</span>
            <div className="hmac-box plain">
              Transmitted Plaintext
              <small>{verifyMsg || "—"}</small>
            </div>
          </div>
          <p className="hmac-note">5. Adds its key to the transmitted plaintext</p>

          <FigureArrow
            lit={step >= 5}
            label="Hashes combination with SHA-256, etc. (same algorithm, no encryption)"
          />

          <div className={rowClass(5)}>
            <div className="hmac-box mac">
              Computed HMAC
              <small>{shortHex(computedHex) || "press Verify"}</small>
            </div>
          </div>

          <FigureArrow
            lit={step >= 6}
            label="6. Compares the transmitted HMAC with the computed HMAC"
          />

          <div className={`${rowClass(6)} hmac-compare`}>
            <div className="hmac-box mac">
              Transmitted HMAC
              <small>{shortHex(tagHex) || "—"}</small>
            </div>
            <span
              className={`hmac-compare-mark${result ? ` ${result}` : ""}`}
              aria-hidden="true"
            >
              {result === "ok" ? "=" : result === "reject" ? "≠" : "⇄"}
            </span>
            <div className="hmac-box mac">
              Computed HMAC
              <small>{shortHex(computedHex) || "—"}</small>
            </div>
          </div>

          <p
            className={`hmac-verdict${step >= 7 ? " lit" : ""}${
              result ? ` ${result}` : ""
            }`}
          >
            {result === "ok"
              ? "7. EQUAL ✓ — authenticated"
              : result === "reject"
                ? "7. NOT EQUAL ✕ — reject"
                : "7. If equal, authenticated; if not, reject"}
          </p>
        </div>
      </div>
      <HmacStepNav step={step} setStep={setStep} onReset={onReset} className="secondary" />

      <div className="hmac-controls">
      <label className="field">
        <span>Shared HMAC key</span>
        <input value={keyText} onChange={(e) => setKeyText(e.target.value)} />
      </label>
      <label className="field">
        <span>Message (≤{PLAINTEXT_MAX})</span>
        <input
          value={safe}
          maxLength={PLAINTEXT_MAX}
          onChange={(e) => setPlaintext(e.target.value.slice(0, PLAINTEXT_MAX))}
        />
      </label>
      <div className="demo-actions">
        <button type="button" disabled={busy || !safe || !keyText} onClick={onCreate}>
          {busy ? "Working…" : "Create HMAC"}
        </button>
      </div>
      {tagHex ? (
        <p className="caption hmac-pipe">
          Tag: <code>{tagHex}</code>
          <br />
          Wire shape: <code>[{tagHex.slice(0, 16)}… ‖ {safe}]</code>
        </p>
      ) : null}

      <h4>Receiver</h4>
      <label className="field">
        <span>Received message (try tampering)</span>
        <input
          value={verifyMsg}
          onChange={(e) => setVerifyMsg(e.target.value.slice(0, PLAINTEXT_MAX))}
        />
      </label>
      <label className="field">
        <span>Receiver key (try wrong key)</span>
        <input value={verifyKey} onChange={(e) => setVerifyKey(e.target.value)} />
      </label>
      <div className="demo-actions">
        <button type="button" disabled={busy || !tagHex} onClick={onVerify}>
          Verify
        </button>
        <button
          type="button"
          disabled={!tagHex}
          onClick={() => {
            setVerifyMsg(`${safe.slice(0, Math.max(0, PLAINTEXT_MAX - 1))}!`);
            setResult(null);
            setComputedHex("");
            setStep(5);
          }}
        >
          Tamper message
        </button>
        <button
          type="button"
          disabled={!tagHex}
          onClick={() => {
            setVerifyKey(`${keyText}-wrong`);
            setResult(null);
            setComputedHex("");
            setStep(5);
          }}
        >
          Use wrong key
        </button>
      </div>
      {result === "ok" ? (
        <p className="caption">Authenticated — HMAC matches.</p>
      ) : null}
      {result === "reject" ? (
        <p className="error">Reject — tamper or wrong key (integrity / message auth failed).</p>
      ) : null}
      </div>
    </section>
  );
}

function NonRepudiationPanel() {
  return (
    <section className="hs-panel">
      <h3>Who could have produced this tag?</h3>
      <div className="trust-contrast">
        <div className="col no">
          <h4>HMAC (shared secret)</h4>
          <p>
            Either party who knows the secret — and anyone who stole it — can make the same
            tag.
          </p>
          <p>
            <strong>Non-repudiation?</strong> No.
          </p>
        </div>
        <div className="col yes">
          <h4>Signature (private key)</h4>
          <p>
            Only the private-key holder can produce a verifying signature (see Part 6.5).
          </p>
          <p>
            <strong>Non-repudiation?</strong> Can support yes (policy still matters).
          </p>
        </div>
      </div>
      <p className="caption">
        Integrity can hold for both; the difference is attribution when the secret is shared.
      </p>
    </section>
  );
}

export default function TrustAuthDemo({ subId, plaintext, setPlaintext, onRealWorldChange }) {
  useEffect(() => {
    if (subId === "certificates") {
      onRealWorldChange?.(TOY_CA_COMMANDS);
    } else if (subId === "live-certificate") {
      onRealWorldChange?.([
        {
          id: "trust-google-live",
          title: "Fetch current www.google.com leaf",
          caption: "Fixed target — the only Real world command that opens an outbound TLS session.",
          commandText:
            "openssl s_client -connect www.google.com:443 -servername www.google.com -showcerts </dev/null",
          runBody: { part: "trust", variant: "s_client-google", plaintext: "cert" },
        },
      ]);
    } else if (subId === "validity") {
      onRealWorldChange?.(REVOKE_COMMANDS);
    } else if (subId === "hmac-lab") {
      // HmacLabPanel owns Real-world commands.
    } else {
      onRealWorldChange?.([]);
    }
  }, [subId, onRealWorldChange]);

  if (subId === "certificates") return <CertificatesPanel />;
  if (subId === "live-certificate") return <LiveCertificatePanel />;
  if (subId === "validity") return <ValidityPanel />;
  if (subId === "hmac-lab") {
    return (
      <HmacLabPanel
        plaintext={plaintext}
        setPlaintext={setPlaintext}
        onRealWorldChange={onRealWorldChange}
      />
    );
  }
  if (subId === "non-repudiation") return <NonRepudiationPanel />;

  return (
    <section className="hs-panel">
      <h3>Part 7 — {subId}</h3>
      <p className="caption">Unknown subsection.</p>
    </section>
  );
}
