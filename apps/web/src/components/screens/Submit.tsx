import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon, TagPill } from "../ui";
import { StatusBadge } from "../ui";
import { AttachmentsField } from "../Attachments";
import { relativeTime } from "../../lib/time";
import { PRESET_TAGS, SEVERITIES, SEV_OPTIONS, WHEN_OPTIONS } from "../../lib/constants";
import { api } from "../../lib/api";
import { useAppCtx } from "../../App";
import type { Bug, Severity, SimilarHit, WhenHint } from "../../types";

export function Submit() {
  const { refreshBugs } = useAppCtx();
  const navigate = useNavigate();
  const onCancel = () => navigate("/dashboard");
  const [title, setTitle] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [titleEdited, setTitleEdited] = useState(false);
  const [what, setWhat] = useState("");
  const [expected, setExpected] = useState("");
  const [affected, setAffected] = useState("");
  const [url, setUrl] = useState("");
  const [when, setWhen] = useState<WhenHint>("Just now");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [tags, setTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");

  const [debouncedWhat, setDebouncedWhat] = useState("");
  const [dupLoading, setDupLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<SimilarHit[]>([]);

  const [aiSuggestedTags, setAiSuggestedTags] = useState<string[]>([]);
  const [aiSuggestedTitle, setAiSuggestedTitle] = useState("");
  const [aiTitleReady, setAiTitleReady] = useState(false);
  const [aiSuggestedSeverity, setAiSuggestedSeverity] = useState<Severity | null>(null);

  const [errors, setErrors] = useState<{ title?: string; what?: string }>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Debounce: 500ms after user stops typing in `what`
  useEffect(() => {
    if (what.trim().length < 8) {
      setDebouncedWhat("");
      setDupLoading(false);
      setDuplicates([]);
      return;
    }
    setDupLoading(true);
    const t = setTimeout(() => setDebouncedWhat(what), 500);
    return () => clearTimeout(t);
  }, [what]);

  // Run similarity search after debounce settles
  useEffect(() => {
    if (!debouncedWhat) return;
    let cancelled = false;
    (async () => {
      try {
        const dups = await api.similar(`${title} ${debouncedWhat}`.trim());
        if (cancelled) return;
        setDuplicates(dups);
      } catch {
        if (!cancelled) setDuplicates([]);
      } finally {
        if (!cancelled) setDupLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedWhat, title]);

  // AI tag suggestion (debounced)
  useEffect(() => {
    if ((title + what).trim().length < 12) {
      setAiSuggestedTags([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const { tags: suggested } = await api.suggestTags(`${title} ${what}`);
        if (cancelled) return;
        setAiSuggestedTags(suggested.filter((t) => !tags.includes(t)));
      } catch {
        if (!cancelled) setAiSuggestedTags([]);
      }
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [title, what, tags]);

  // AI severity suggestion (debounced)
  useEffect(() => {
    if ((title + what).trim().length < 12) {
      setAiSuggestedSeverity(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const { severity: s } = await api.suggestSeverity(`${title} ${what}`);
        if (!cancelled) setAiSuggestedSeverity(s);
      } catch {
        if (!cancelled) setAiSuggestedSeverity(null);
      }
    }, 1000);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [title, what]);

  // AI title — fires once. Locks the title field until AI returns
  // (success or failure), then auto-populates and unlocks.
  useEffect(() => {
    if (aiTitleReady) return;
    if (titleEdited) return;
    if (what.trim().length < 24) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      let suggested = "";
      try {
        const r = await api.suggestTitle(what);
        suggested = r.title ?? "";
      } catch {
        // ignore — we still unlock below
      }
      if (cancelled) return;
      setAiSuggestedTitle(suggested);
      if (suggested) setTitle(suggested);
      setAiTitleReady(true);
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [what, titleEdited, aiTitleReady]);

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }
  function addCustomTag() {
    const t = customTagInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
    if (!t) return;
    if (!tags.includes(t)) setTags([...tags, t]);
    setCustomTagInput("");
  }
  function acceptAITag(tag: string) {
    if (!tags.includes(tag)) setTags([...tags, tag]);
  }

  function validate(): boolean {
    const e: { title?: string; what?: string } = {};
    if (!title.trim()) e.title = "Add a short title.";
    if (!what.trim()) e.what = "Describe what happened.";
    else if (what.trim().length < 12) e.what = "A little more detail helps triage.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(asDuplicateOf: number | null = null) {
    setSubmitted(true);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const created = await api.createBug({
        title: title.trim(),
        what: what.trim(),
        expected: expected.trim(),
        affected: affected.trim(),
        url: url.trim(),
        when,
        severity,
        tags,
        asDuplicateOf,
      });
      if (pendingFiles.length > 0) {
        try {
          await api.uploadAttachments(created.id, pendingFiles);
        } catch (err) {
          console.error("attachment upload failed", err);
          // The bug exists; surface the failure but don't block the flow.
          alert("Bug filed, but uploading evidence failed. Add files from the bug detail page.");
        }
      }
      try {
        await refreshBugs();
      } catch {
        // non-fatal — Confirm can still find the new bug via navigate state
      }
      navigate("/report/confirm", {
        state: { newBugId: created.id, duplicateOfId: asDuplicateOf },
      });
    } catch (err) {
      console.error(err);
      alert("Could not file bug — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const titleLocked = !titleEdited && !aiTitleReady;
  const titleIsAi =
    aiSuggestedTitle.length > 0 && title === aiSuggestedTitle && !titleEdited;
  const titlePlaceholder = titleLocked
    ? what.trim().length < 24
      ? "Describe what happened first — we'll suggest a title"
      : "✨ Generating title…"
    : "Short summary";

  return (
    <div className="main main--narrow">
      <div className="page-header">
        <div>
          <h1 className="page-title">Report a bug</h1>
          <p className="page-subtitle">
            We'll check for similar reports as you describe what happened.
          </p>
        </div>
        <button className="icon-btn" onClick={onCancel} aria-label="Cancel">
          <Icon.close />
        </button>
      </div>

      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(null);
        }}
      >
        {/* Title */}
        <div className="field">
          <div className="field__row">
            <label className="field__label" htmlFor="bt-title">
              Title<span className="req">*</span>
            </label>
            {titleLocked && what.trim().length >= 24 && (
              <span className="ai-tag-suggest">
                <span className="ai-pulse" /> Generating
              </span>
            )}
            {titleIsAi && (
              <span className="ai-tag-suggest">
                <Icon.sparkle /> AI-generated · edit if needed
              </span>
            )}
          </div>
          <input
            id="bt-title"
            className="app-input app-input--inline"
            placeholder={titlePlaceholder}
            value={title}
            disabled={titleLocked}
            style={titleLocked ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleEdited(true);
            }}
          />
          {submitted && errors.title && (
            <div className="field__error">
              <Icon.alert /> {errors.title}
            </div>
          )}
        </div>

        {/* What happened */}
        <div className="field">
          <div className="field__row">
            <label className="field__label" htmlFor="bt-what">
              What happened<span className="req">*</span>
            </label>
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
          {submitted && errors.what && (
            <div className="field__error">
              <Icon.alert /> {errors.what}
            </div>
          )}

          <DuplicatePanel
            loading={dupLoading}
            duplicates={duplicates}
            visible={debouncedWhat.length > 0 || dupLoading}
            onLink={(bugId) => handleSubmit(bugId)}
          />
        </div>

        {/* Expected */}
        <div className="field">
          <label className="field__label" htmlFor="bt-exp">
            Expected behavior{" "}
            <span className="field__hint" style={{ fontWeight: 400 }}>
              (optional)
            </span>
          </label>
          <textarea
            id="bt-exp"
            className="app-textarea app-textarea--sm"
            placeholder="What should have happened instead?"
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
          />
        </div>

        {/* Context: Affected user + URL */}
        <div className="field">
          <label className="field__label">
            Context{" "}
            <span className="field__hint" style={{ fontWeight: 400 }}>
              (optional)
            </span>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
            {WHEN_OPTIONS.map((opt) => (
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
          <div className="field__row">
            <label className="field__label">Severity</label>
            {aiSuggestedSeverity && aiSuggestedSeverity !== severity && (
              <button
                type="button"
                onClick={() => {
                  setSeverity(aiSuggestedSeverity);
                  setAiSuggestedSeverity(null);
                }}
                className="ai-tag-suggest"
                style={{ background: "transparent", border: 0, cursor: "pointer", padding: 0 }}
              >
                <Icon.sparkle /> AI suggests {SEVERITIES[aiSuggestedSeverity].label.toLowerCase()} — accept
              </button>
            )}
          </div>
          <div className="chip-row">
            {SEV_OPTIONS.map((opt) => (
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
                      severity === opt
                        ? "rgba(255,255,255,0.95)"
                        : `var(--sev-${opt})`,
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
            {PRESET_TAGS.map((t) => (
              <TagPill
                key={t}
                onClick={() => toggleTag(t)}
                selected={tags.includes(t)}
                variant={tags.includes(t) ? undefined : "ghost"}
              >
                #{t}
              </TagPill>
            ))}
            {aiSuggestedTags.map((t) => (
              <TagPill key={"ai-" + t} ai onClick={() => acceptAITag(t)}>
                <Icon.sparkle style={{ marginRight: 4 }} />#{t}
              </TagPill>
            ))}
            {tags
              .filter((t) => !PRESET_TAGS.includes(t))
              .map((t) => (
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomTag();
                }
              }}
            />
          </div>
        </div>

        <AttachmentsField files={pendingFiles} onChange={setPendingFiles} />

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
          <button type="submit" className="btn btn--primary btn--lg" disabled={submitting}>
            {submitting ? "Filing…" : "Submit as new bug"}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <span
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}
            className="field__hint"
          >
            <span className="kbd">⌘</span>
            <span className="kbd">⏎</span> to submit
          </span>
        </div>
      </form>
    </div>
  );
}

function DuplicatePanel({
  loading,
  duplicates,
  visible,
  onLink,
}: {
  loading: boolean;
  duplicates: SimilarHit[];
  visible: boolean;
  onLink: (bugId: number) => void;
}) {
  if (!visible) return null;
  return (
    <div className="dup-panel">
      <div className="dup-panel__head">
        <div className="dup-panel__title">
          <Icon.sparkle style={{ color: "var(--purple-500)" }} />
          <span>
            {loading
              ? "Searching past bugs…"
              : duplicates.length > 0
                ? "Possible duplicates"
                : "Past bugs checked"}
          </span>
        </div>
        <span className="dup-panel__sub">Semantic similarity over your bug history</span>
      </div>

      {loading && (
        <div>
          <div className="dup-skeleton" style={{ animationDelay: "0s" }} />
          <div className="dup-skeleton" style={{ animationDelay: "0.15s", opacity: 0.7 }} />
        </div>
      )}

      {!loading && duplicates.length === 0 && (
        <div className="dup-empty">No similar bugs found — this looks new.</div>
      )}

      {!loading &&
        duplicates.map(({ bug, score }, idx) => (
          <DupCard
            key={bug.id}
            bug={bug}
            score={score}
            delay={idx * 80}
            onLink={() => onLink(bug.id)}
          />
        ))}
    </div>
  );
}

function DupCard({
  bug,
  score,
  delay,
  onLink,
}: {
  bug: Bug;
  score: number;
  delay: number;
  onLink: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
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
          {bug.tags.map((t) => (
            <TagPill key={t}>#{t}</TagPill>
          ))}
          <span>· #{bug.id}</span>
          <span>· Reported {relativeTime(bug.createdAt)}</span>
          {bug.duplicateCount > 0 && (
            <span>
              · {bug.duplicateCount} duplicate {bug.duplicateCount === 1 ? "report" : "reports"}
            </span>
          )}
        </div>
      </div>
      <div className="dup-card__right">
        <div className="sim-bar">
          <span>{Math.round(filledScore * 100)}%</span>
          <span className="sim-bar__track">
            <span
              className="sim-bar__fill"
              style={{ width: filledScore * 100 + "%" }}
            />
          </span>
        </div>
        <button type="button" className="btn btn--primary btn--sm" onClick={onLink}>
          This is the same
        </button>
      </div>
    </div>
  );
}
