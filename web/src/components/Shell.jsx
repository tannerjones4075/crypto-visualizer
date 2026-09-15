import CiaCallout from "./CiaCallout.jsx";
import CollapsibleBand from "./CollapsibleBand.jsx";
import RealWorld from "./RealWorld.jsx";
import { StageIcon } from "./StageVisuals.jsx";

export default function Shell({
  parts,
  currentId,
  onSelect,
  children,
  realWorld,
  part,
  beforeRealWorld,
  optionalBand,
  advanced,
  subsections,
  currentSubId,
  onSelectSub,
  onBack,
  onNext,
  canBack,
  canNext,
  chapterTitle,
}) {
  const idx = parts.findIndex((p) => p.id === currentId);
  const prev = idx > 0 ? parts[idx - 1] : null;
  const next = idx >= 0 && idx < parts.length - 1 ? parts[idx + 1] : null;

  const handleBack = onBack ?? (() => prev && onSelect(prev.id));
  const handleNext = onNext ?? (() => next && onSelect(next.id));
  const backEnabled = canBack ?? Boolean(prev);
  const nextEnabled = canNext ?? Boolean(next);

  return (
    <div className="shell">
      <header className="top">
        <div>
          <p className="brand">Cryptography Visualizer</p>
          {chapterTitle ? <p className="chapter-eyebrow">{chapterTitle}</p> : null}
          <h1>{part.title}</h1>
        </div>
        <span className={`status status-${part.status}`}>{part.statusLabel}</span>
      </header>

      <nav className="part-nav" aria-label="Lesson parts">
        <div className="part-list">
          {parts.map((p) => (
            <button
              key={p.id}
              type="button"
              className={p.id === currentId ? "active" : ""}
              onClick={() => onSelect(p.id)}
            >
              {p.title}
            </button>
          ))}
        </div>
        <div className="part-step">
          <button type="button" disabled={!backEnabled} onClick={handleBack}>
            Back
          </button>
          <button type="button" disabled={!nextEnabled} onClick={handleNext}>
            Next
          </button>
        </div>
      </nav>

      {subsections?.length ? (
        <nav className="sub-nav" aria-label={`${chapterTitle || "Part"} sections`}>
          {subsections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === currentSubId ? "active" : ""}
              onClick={() => onSelectSub?.(s.id)}
            >
              <StageIcon id={s.id} className="stage-icon sub-nav-icon" />
              <span className="sub-nav-label">{s.label}</span>
              {s.title}
            </button>
          ))}
        </nav>
      ) : null}

      <div className="split">
        <aside className="teach">
          {part.teach?.definition ? (
            <>
              <h2>
                {typeof part.teach.definition === "object"
                  ? part.teach.definition.title
                  : "What is cryptography?"}
              </h2>
              {typeof part.teach.definition === "object" ? (
                Array.isArray(part.teach.definition.body) ? (
                  <ul className="teach-steps">
                    {part.teach.definition.body.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{part.teach.definition.body}</p>
                )
              ) : (
                <p>{part.teach.definition}</p>
              )}
            </>
          ) : null}
          {part.teach?.originalPurpose ? (
            <>
              <h2>Original purpose</h2>
              <p>{part.teach.originalPurpose}</p>
            </>
          ) : null}
          {part.teach?.kerckhoffs ? (
            <blockquote className="principle">
              <p className="principle-label">{part.teach.kerckhoffs.attribution}</p>
              <p>“{part.teach.kerckhoffs.quote}”</p>
            </blockquote>
          ) : null}
          {part.cia ? <CiaCallout cia={part.cia} mode={part.ciaMode || "full"} /> : null}
          {part.teach?.what ? (
            <>
              <h2>What this is</h2>
              {Array.isArray(part.teach.what) ? (
                <ul className="teach-steps">
                  {part.teach.what.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>{part.teach.what}</p>
              )}
            </>
          ) : null}
          {part.teach?.roles ? (
            <>
              <h2>Roles</h2>
              <p>{part.teach.roles}</p>
            </>
          ) : null}
          {part.teach?.steps?.length ? (
            <>
              <h2>How it works</h2>
              <ol className="teach-steps">
                {part.teach.steps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </>
          ) : null}
          {part.teach?.encryption ? (
            <>
              <h2>Encryption</h2>
              <p>{part.teach.encryption}</p>
            </>
          ) : null}
          {part.teach?.pros?.length || part.teach?.cons?.length ? (
            <div className="pros-cons">
              {part.teach?.pros?.length ? (
                <div className="pros">
                  <h2>Pros</h2>
                  <ul>
                    {part.teach.pros.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {part.teach?.cons?.length ? (
                <div className="cons">
                  <h2>Cons</h2>
                  <ul>
                    {part.teach.cons.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          {part.teach?.why ? (
            <>
              <h2>Why it matters</h2>
              <p>{part.teach.why}</p>
            </>
          ) : null}
          {part.teach?.plaintext ? (
            <>
              <h2>Plaintext</h2>
              <p>{part.teach.plaintext}</p>
            </>
          ) : null}
          {part.teach?.cipher ? (
            <>
              <h2>Cipher</h2>
              {Array.isArray(part.teach.cipher) ? (
                <ul className="teach-steps">
                  {part.teach.cipher.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>{part.teach.cipher}</p>
              )}
            </>
          ) : null}
          {part.teach?.key ? (
            <>
              <h2>Key</h2>
              <p>{part.teach.key}</p>
            </>
          ) : null}
          {part.teach?.mode ? (
            <>
              <h2>Mode</h2>
              <p>{part.teach.mode}</p>
            </>
          ) : null}
          {part.teach?.keystream ? (
            <>
              <h2>Keystream</h2>
              <p>{part.teach.keystream}</p>
            </>
          ) : null}
          {part.teach?.ciphertext ? (
            <>
              <h2>Ciphertext</h2>
              <p>{part.teach.ciphertext}</p>
            </>
          ) : null}
          {part.teach?.hex ? (
            <>
              <h2>Hex</h2>
              <p>{part.teach.hex}</p>
            </>
          ) : null}
          {part.teach?.xor ? (
            <>
              <h2>XOR</h2>
              <p>{part.teach.xor}</p>
            </>
          ) : null}
          {part.teach?.leaveWith ? (
            <>
              <h2>Leave with</h2>
              <p>{part.teach.leaveWith}</p>
            </>
          ) : null}
          {part.teach?.hybridSplit ? (
            <div className="hybrid-split">
              <h2>Asymmetric vs symmetric</h2>
              <div className="hybrid-split-grid">
                <div>
                  <h3>{part.teach.hybridSplit.asymmetricTitle}</h3>
                  <p className="hybrid-purpose">
                    Purpose: {part.teach.hybridSplit.asymmetricPurpose}
                  </p>
                  <ul>
                    {part.teach.hybridSplit.asymmetricPoints.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>{part.teach.hybridSplit.symmetricTitle}</h3>
                  <p className="hybrid-purpose">
                    Purpose: {part.teach.hybridSplit.symmetricPurpose}
                  </p>
                  <ul>
                    {part.teach.hybridSplit.symmetricPoints.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </aside>
        <section className="demo">{children}</section>
      </div>

      {beforeRealWorld ? (
        <div className="before-real-world-slot">{beforeRealWorld}</div>
      ) : null}

      {optionalBand ? (
        <div className="optional-band-slot" key={`opt-${currentId}-${currentSubId || ""}`}>
          {optionalBand}
        </div>
      ) : null}

      <RealWorld
        key={`rw-${currentId}-${currentSubId || ""}`}
        {...realWorld}
        note={part.realWorldNote}
        caseStudy={part.realWorldCaseStudy}
      />

      {advanced ? (
        <div className="advanced-slot">
          <CollapsibleBand
            key={`adv-${currentId}`}
            title="Advanced"
            note="Optional deeper look — not required for the main lesson."
            defaultOpen={false}
            className="advanced-band"
          >
            {advanced}
          </CollapsibleBand>
        </div>
      ) : null}

      <footer className="disclaimer">{part.disclaimer}</footer>
    </div>
  );
}
