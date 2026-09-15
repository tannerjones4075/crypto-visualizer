import CollapsibleBand from "./CollapsibleBand.jsx";

export default function RealWorld({ commands, results, note, caseStudy, runningId, onRun }) {
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  const resultById = Object.fromEntries((results ?? []).map((r) => [r.id, r]));

  return (
    <CollapsibleBand title="Real world" note={note} defaultOpen className="real-world">
      <div className="rw-sections">
        {(commands ?? []).map((cmd) => {
          const result = resultById[cmd.id];
          const running = runningId === cmd.id;
          return (
            <div key={cmd.id} className="rw-section">
              <h3>{cmd.title}</h3>
              {cmd.caption ? <p className="caption">{cmd.caption}</p> : null}
              <div className="command-row">
                <pre className="command">{cmd.commandText}</pre>
                <div className="command-actions">
                  <button
                    type="button"
                    onClick={() => copy(cmd.commandText)}
                    disabled={!cmd.commandText}
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => onRun(cmd)}
                    disabled={!cmd.runBody || runningId != null}
                  >
                    {running ? "Running…" : "Run"}
                  </button>
                </div>
              </div>
              {result ? (
                <div className="run-result">
                  {result.error ? <p className="error">{result.error}</p> : null}
                  <h4>stdout</h4>
                  <pre>{result.stdout || "(empty)"}</pre>
                </div>
              ) : null}
              {cmd.applications?.length ? (
                <aside className="rw-apps">
                  <h4>Real-world applications</h4>
                  <ul>
                    {cmd.applications.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </aside>
              ) : null}
            </div>
          );
        })}
      </div>

      {caseStudy ? (
        <aside className="rw-case-study">
          <h3>
            {caseStudy.title.includes(":") ? (
              <>
                <strong>{caseStudy.title.split(":")[0]}</strong>:
                {caseStudy.title.slice(caseStudy.title.indexOf(":") + 1)}
              </>
            ) : (
              caseStudy.title
            )}
          </h3>
          {caseStudy.paragraphs?.map((p) => {
            if (typeof p === "string") {
              return <p key={p.slice(0, 48)}>{p}</p>;
            }
            return (
              <p key={p.lead || p.text.slice(0, 48)}>
                {p.lead ? (
                  <>
                    <strong>{p.lead}</strong>: {p.text}
                  </>
                ) : (
                  p.text
                )}
              </p>
            );
          })}
        </aside>
      ) : null}
    </CollapsibleBand>
  );
}
