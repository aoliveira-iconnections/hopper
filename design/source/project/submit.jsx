/* Submit Bug screen — the hero flow with duplicate detection */
/* eslint-disable no-undef */

const { useState, useEffect, useRef, useMemo } = React;

const WHEN_OPTIONS = ["Just now", "Earlier today", "Yesterday", "Specific time"];
const SEV_OPTIONS = ["low", "medium", "high", "critical"];

function SubmitScreen({ bugs, onSubmit, onCancel }) {
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [what, setWhat] = useState("");
  const [expected, setExpected] = useState("");
  const [affected, setAffected] = useState("");
  const [url, setUrl] = useState("");
  const [when, setWhen] = useState("Just now");
  const [severity, setSeverity] = useState("medium");
  const [tags, setTags] = useState([]);
  const [customTagInput, setCustomTagInput] = useState("");

  const [debouncedWhat, setDebouncedWhat] = useState("");
  const [dupLoading, setDupLoading] = useState(false);
  const [duplicates, setDuplicates] = useState([]);

  const [aiSuggestedTags, setAiSuggestedTags] = useState([]);
  const [aiSuggestedTitle, setAiSuggestedTitle] = useState("");
  const [titleAccepted, setTitleAccepted] = useState(false);

  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  // Debounce: 500ms after user stops typing in `what`
  useEffect(() => {
    if (what.trim().length < 8) {
      setDebouncedWhat("");
      setDupLoading(false);
      setDuplicates([]);
      return;
    }
    setDupLoading(true);
    const t = setTimeout(() => {
      setDebouncedWhat(what);
    }, 500);
    return () => clearTimeout(t);
  }, [what]);

  // Run search after debounce settles (small extra delay to show skeleton)
  useEffect(() => {
    if (!debouncedWhat) return;
    const t = setTimeout(() => {
      const dups = findDuplicates(debouncedWhat + " " + title, bugs, 3);
      setDuplicates(dups);
      setDupLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [debouncedWhat, title, bugs]);

  // AI tag suggestion (live as the user types)
  useEffect(() => {
    const tagSugg = suggestTags(title + " " + what);
    setAiSuggestedTags(tagSugg.filter(t => !tags.includes(t)));
  }, [title, what, tags]);

  // AI title suggestion (only if user hasn't typed a title or the description is much fuller)
  useEffect(() => {
    if (titleEdited && title.trim().length > 0) return;
    const sugg = suggestTitle(what);
    setAiSuggestedTitle(sugg);
  }, [what, titleEdited, title]);

  function toggleTag(tag) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }
  function addCustomTag() {
    const t = customTagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!t) return;
    if (!tags.includes(t)) setTags([...tags, t]);
    setCustomTagInput("");
  }
  function acceptAITitle() {
    if (!aiSuggestedTitle) return;
    setTitle(aiSuggestedTitle);
    setTitleAccepted(true);
  }
  function acceptAITag(tag) {
    if (!tags.includes(tag)) setTags([...tags, tag]);
  }

  function validate() {
    const e = {};
    if (!title.trim()) e.title = "Add a short title.";
    if (!what.trim()) e.what = "Describe what happened.";
    else if (what.trim().length < 12) e.what = "A little more detail helps triage.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(asDuplicateOf = null) {
    setSubmitted(true);
    if (!validate()) return;
    const newBug = {
      id: Math.max(...bugs.map(b => b.id)) + 1,
      title: title.trim(),
      what: what.trim(),
      expected: expected.trim(),
      affected: affected.trim(),
      url: url.trim(),
      when, severity, tags,
      status: "new",
      reporter: "You",
      reporterEmail: "you@iconnections.io",
      createdAt: Date.now(),
      duplicateOf: asDuplicateOf,
      duplicateCount: 0,
      slackTs: String(Date.now() / 1000),
    };
    onSubmit(newBug, asDuplicateOf);
  }

  const showAITitleSuggest = aiSuggestedTitle && !titleAccepted &&
    (title.trim().length === 0 || (title !== aiSuggestedTitle && !titleEdited));

  return (
    <div className="main main--narrow">
      <div className="page-header">
        <div>
          <h1 className="page-title">Report a bug</h1>
          <p className="page-subtitle">We'll check for similar reports as you describe what happened.</p>
        </div>
        <button className="icon-btn" onClick={onCancel} aria-label="Cancel">
          <Icon.close />
        </button>
      </div>

      <form className="form-stack" onSubmit={(e) => { e.preventDefault(); handleSubmit(null); }}>
        {/* Title */}
        <div className="field">
          <div className="field__row">
            <label className="field__label" htmlFor="bt-title">Title<span className="req">*</span></label>
            {showAITitleSuggest && (
              <button type="button" onClick={acceptAITitle} className="ai-tag-suggest" style={{ background:"transparent", border:"0", cursor:"pointer", padding:0 }}>
                <Icon.sparkle /> Use AI title
              </button>
            )}
          </div>
          <input
            id="bt-title"
            className="app-input app-input--inline"
            placeholder={aiSuggestedTitle || "Short summary"}
            value={title}
            onChange={(e) => { setTitle(e.target.value); setTitleEdited(true); setTitleAccepted(false); }}
          />
          {showAITitleSuggest && (
            <div className="field__hint" style={{ display:"flex", alignItems:"center", gap: 6 }}>
              <Icon.sparkle style={{ color: "var(--purple-500)" }}/>
              <span>Suggested: <em style={{ fontStyle:"normal", color:"var(--app-ink)" }}>"{aiSuggestedTitle}"</em></span>
              <span style={{ marginLeft:"auto" }}>
                <button type="button" className="btn btn--ghost btn--sm" onClick={acceptAITitle} style={{ padding:"4px 10px" }}>Accept</button>
              </span>
            </div>
          )}
          {submitted && errors.title && <div className="field__error"><Icon.alert /> {errors.title}</div>}
        </div>

        {/* What happened */}
        <div className="field">
          <div className="field__row">
            <label className="field__label" htmlFor="bt-what">What happened<span className="req">*</span></label>
            <span className="field__hint">{what.length} chars</span>
          </div>
          <textarea
            id="bt-what"
            className="app-textarea"
            rows={6}
            placeholder="Describe the steps, what you saw, anything unusual…"
            value={what}
            onChange={(e) => setWhat(e.target.value)}
          />
          {submitted && errors.what && <div className="field__error"><Icon.alert /> {errors.what}</div>}

          {/* Duplicate panel */}
          <DuplicatePanel
            loading={dupLoading}
            duplicates={duplicates}
            visible={debouncedWhat.length > 0 || dupLoading}
            onLink={(bugId) => handleSubmit(bugId)}
          />
        </div>

        {/* Expected */}
        <div className="field">
          <label className="field__label" htmlFor="bt-exp">Expected behavior <span className="field__hint" style={{ fontWeight:400 }}>(optional)</span></label>
          <textarea
            id="bt-exp"
            className="app-textarea app-textarea--sm"
            placeholder="What should have happened instead?"
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
          />
        </div>

        {/* Affected user + URL */}
        <div className="field">
          <label className="field__label">Context <span className="field__hint" style={{ fontWeight:400 }}>(optional)</span></label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap: 12 }}>
            <input
              className="app-input"
              placeholder="Affected user — email or user ID"
              value={affected}
              onChange={(e) => setAffected(e.target.value)}
            />
            <input
              className="app-input"
              placeholder="URL where it happened"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        </div>

        {/* When */}
        <div className="field">
          <label className="field__label">When did it happen?</label>
          <div className="chip-row">
            {WHEN_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                className={`chip ${when === opt ? "is-selected" : ""}`}
                onClick={() => setWhen(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Severity */}
        <div className="field">
          <label className="field__label">Severity</label>
          <div className="chip-row">
            {SEV_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                className={`chip ${severity === opt ? "is-selected" : ""}`}
                onClick={() => setSeverity(opt)}
              >
                <span
                  className="chip__sev-dot"
                  style={{
                    background:
                      severity === opt ? "rgba(255,255,255,0.95)" :
                      `var(--sev-${opt})`,
                  }}
                />
                {SEVERITIES[opt].label}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="field">
          <div className="field__row">
            <label className="field__label">Tags</label>
            {aiSuggestedTags.length > 0 && (
              <span className="ai-tag-suggest">
                <span className="ai-pulse" /> AI suggestions
              </span>
            )}
          </div>
          <div className="chip-row">
            {PRESET_TAGS.map(t => (
              <TagPill
                key={t}
                onClick={() => toggleTag(t)}
                selected={tags.includes(t)}
                variant={tags.includes(t) ? undefined : "ghost"}
              >
                #{t}
              </TagPill>
            ))}
            {aiSuggestedTags.map(t => (
              <TagPill key={"ai-" + t} ai onClick={() => acceptAITag(t)}>
                <Icon.sparkle style={{ marginRight: 4 }} />#{t}
              </TagPill>
            ))}
            {tags.filter(t => !PRESET_TAGS.includes(t)).map(t => (
              <TagPill key={"c-" + t} selected onClick={() => toggleTag(t)}>
                #{t} <span style={{ marginLeft: 4, opacity: 0.7 }}>×</span>
              </TagPill>
            ))}
            <input
              className="app-input"
              placeholder="add tag…"
              style={{ width: 120, padding: "5px 10px", fontSize: 13, borderRadius: 999 }}
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display:"flex", gap: 12, alignItems:"center", marginTop: 8 }}>
          <button type="submit" className="btn btn--primary btn--lg">
            Submit as new bug
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <span style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap: 6 }} className="field__hint">
            <span className="kbd">⌘</span><span className="kbd">⏎</span> to submit
          </span>
        </div>
      </form>
    </div>
  );
}

function DuplicatePanel({ loading, duplicates, visible, onLink }) {
  if (!visible) return null;
  return (
    <div className="dup-panel" key="dup-panel">
      <div className="dup-panel__head">
        <div className="dup-panel__title">
          <Icon.sparkle style={{ color: "var(--purple-500)" }} />
          <span>{loading ? "Searching past bugs…" : duplicates.length > 0 ? "Possible duplicates" : "Past bugs checked"}</span>
        </div>
        <span className="dup-panel__sub">Semantic match across 142 bugs</span>
      </div>

      {loading && (
        <div>
          <div className="dup-skeleton" style={{ animationDelay: "0s" }}/>
          <div className="dup-skeleton" style={{ animationDelay: "0.15s", opacity: 0.7 }}/>
        </div>
      )}

      {!loading && duplicates.length === 0 && (
        <div className="dup-empty">No similar bugs found — this looks new.</div>
      )}

      {!loading && duplicates.map(({ bug, score }, idx) => (
        <DupCard key={bug.id} bug={bug} score={score} delay={idx * 80} onLink={() => onLink(bug.id)} />
      ))}
    </div>
  );
}

function DupCard({ bug, score, delay, onLink }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.style.animationDelay = delay + "ms";
  }, [delay]);
  const [filledScore, setFilledScore] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setFilledScore(score), 60 + delay);
    return () => clearTimeout(t);
  }, [score, delay]);
  return (
    <div className="dup-card" ref={ref}>
      <div className="dup-card__main">
        <div className="dup-card__title">{bug.title}</div>
        <div className="dup-card__meta">
          <StatusBadge status={bug.status} />
          {bug.tags.map(t => <TagPill key={t}>#{t}</TagPill>)}
          <span>· #{bug.id}</span>
          <span>· Reported {relativeTime(bug.createdAt)}</span>
          {bug.duplicateCount > 0 && <span>· {bug.duplicateCount} duplicate {bug.duplicateCount === 1 ? "report" : "reports"}</span>}
        </div>
      </div>
      <div className="dup-card__right">
        <div className="sim-bar">
          <span>{Math.round(filledScore * 100)}%</span>
          <span className="sim-bar__track"><span className="sim-bar__fill" style={{ width: (filledScore * 100) + "%" }}/></span>
        </div>
        <button type="button" className="btn btn--primary btn--sm" onClick={onLink}>
          This is the same
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { SubmitScreen });
