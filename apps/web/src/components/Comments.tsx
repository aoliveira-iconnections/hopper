import { useEffect, useRef, useState } from "react";
import { Avatar, Icon } from "./ui";
import { relativeTime } from "../lib/time";
import { api } from "../lib/api";
import type { Comment } from "../types";

const MAX_LEN = 5000;

export function CommentsPanel({
  bugId,
  currentUserId,
}: {
  bugId: number;
  currentUserId: number;
}) {
  const [items, setItems] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listComments(bugId)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bugId]);

  async function handleSubmit() {
    const body = draft.trim();
    if (!body) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createComment(bugId, body);
      setItems((prev) => [...prev, created]);
      setDraft("");
    } catch (err) {
      console.error(err);
      setError("Could not post comment — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleUpdated(updated: Comment) {
    setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  function handleDeleted(id: number) {
    setItems((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="detail-section">
      <div className="detail-section__label">
        Discussion {!loading && `· ${items.length}`}
      </div>

      {loading ? (
        <div className="dup-skeleton" style={{ height: 60 }} />
      ) : items.length === 0 ? (
        <div style={{ color: "var(--app-ink-muted)", fontSize: 13, marginTop: 4 }}>
          No comments yet. Ask a follow-up, share repro steps, or note progress.
        </div>
      ) : (
        <div className="comments-list">
          {items.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              canEdit={c.author.id === currentUserId}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      <CommentComposer
        value={draft}
        onChange={setDraft}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
      {error && (
        <div className="field__error" style={{ marginTop: 6 }}>
          <Icon.alert /> {error}
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  canEdit,
  onUpdated,
  onDeleted,
}: {
  comment: Comment;
  canEdit: boolean;
  onUpdated: (c: Comment) => void;
  onDeleted: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);

  async function save() {
    const body = draft.trim();
    if (!body || body === comment.body) {
      setEditing(false);
      setDraft(comment.body);
      return;
    }
    setBusy(true);
    try {
      const updated = await api.updateComment(comment.id, body);
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this comment?")) return;
    setBusy(true);
    try {
      await api.deleteComment(comment.id);
      onDeleted(comment.id);
    } catch (err) {
      console.error(err);
      setBusy(false);
    }
  }

  return (
    <div className="comment">
      <Avatar name={comment.author.name} size="sm" />
      <div className="comment__body">
        <div className="comment__head">
          <span className="comment__author">{comment.author.name}</span>
          <span className="comment__time">
            {relativeTime(comment.createdAt)}
            {comment.edited && " · edited"}
          </span>
          {canEdit && !editing && (
            <span className="comment__actions">
              <button
                type="button"
                className="comment__action"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              <button
                type="button"
                className="comment__action comment__action--danger"
                onClick={remove}
                disabled={busy}
              >
                Delete
              </button>
            </span>
          )}
        </div>

        {editing ? (
          <>
            <textarea
              className="app-textarea app-textarea--sm"
              value={draft}
              maxLength={MAX_LEN}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={save}
                disabled={busy || draft.trim().length === 0}
              >
                Save
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setEditing(false);
                  setDraft(comment.body);
                }}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="comment__text">{comment.body}</div>
        )}
      </div>
    </div>
  );
}

function CommentComposer({
  value,
  onChange,
  onSubmit,
  submitting,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  return (
    <div className="comment-composer">
      <textarea
        ref={taRef}
        className="app-textarea app-textarea--sm"
        rows={3}
        placeholder="Add a comment…"
        value={value}
        maxLength={MAX_LEN}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      <div className="comment-composer__actions">
        <span className="field__hint">
          <span className="kbd">⌘</span>
          <span className="kbd">⏎</span> to send
        </span>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={onSubmit}
          disabled={submitting || value.trim().length === 0}
        >
          {submitting ? "Posting…" : "Comment"}
        </button>
      </div>
    </div>
  );
}
