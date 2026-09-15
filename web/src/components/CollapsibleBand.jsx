import { useState } from "react";

/** Full-width panel with Show/Hide toggle. */
export default function CollapsibleBand({
  title,
  note,
  defaultOpen = true,
  className = "",
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`collapsible-band ${className}`.trim()}>
      <div className="collapsible-band-header">
        <button
          type="button"
          className="collapsible-band-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <h2>{title}</h2>
          <span className="collapsible-band-action">{open ? "Hide" : "Show"}</span>
        </button>
        {open && note ? <p className="note">{note}</p> : null}
      </div>
      {open ? <div className="collapsible-band-body">{children}</div> : null}
    </section>
  );
}
