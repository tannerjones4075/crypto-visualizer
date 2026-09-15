export default function CiaCallout({ cia, mode = "full" }) {
  const rows = [
    { key: "C", name: "Confidentiality", short: "C", ...cia.confidentiality },
    { key: "I", name: "Integrity", short: "I", ...cia.integrity },
    { key: "A", name: "Availability", short: "A", ...cia.availability },
  ];

  if (mode === "icons") {
    return (
      <div className="cia-icons" role="group" aria-label="CIA triad">
        <p className="cia-icons-label">CIA</p>
        <div className="cia-icons-row">
          {rows.map((row) => {
            const rating = row.rating || "na";
            const title =
              rating === "good"
                ? `${row.name}: effective`
                : rating === "bad"
                  ? `${row.name}: not effective`
                  : rating === "warn"
                    ? `${row.name}: legacy / limited`
                    : `${row.name}: not applicable`;
            return (
              <div
                key={row.key}
                className={`cia-icon cia-${rating}`}
                title={title}
                aria-label={title}
              >
                <span className="cia-letter">{row.short}</span>
                <span className="cia-rating">
                  {rating === "good" ? "✓" : rating === "bad" ? "✗" : rating === "warn" ? "!" : "N/A"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="cia">
      <h3>CIA callout</h3>
      <ul>
        {rows.map((row) => (
          <li key={row.name}>
            <strong>{row.name}</strong>
            <span className="cia-tag">{row.tag}</span>
            <p>{row.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
