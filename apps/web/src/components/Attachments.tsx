import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui";
import { api, ATTACHMENT_LIMITS } from "../lib/api";
import type { Attachment } from "../types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

function validateFile(f: File): string | null {
  if (!ATTACHMENT_LIMITS.allowedMime.includes(f.type)) {
    return `Type not allowed: ${f.type || "unknown"}`;
  }
  if (f.size > ATTACHMENT_LIMITS.maxFileBytes) {
    return `Too large: ${formatSize(f.size)} (max ${formatSize(ATTACHMENT_LIMITS.maxFileBytes)})`;
  }
  return null;
}

// Local-only file picker used inside the Submit form. Files aren't uploaded
// here — the parent collects them and uploads after the bug is created.
export function AttachmentsField({
  files,
  onChange,
}: {
  files: File[];
  onChange: (next: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming);
    const accepted: File[] = [];
    for (const f of arr) {
      const err = validateFile(f);
      if (err) {
        setError(err);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length === 0) return;
    setError(null);
    const merged = [...files, ...accepted].slice(0, ATTACHMENT_LIMITS.maxFilesPerRequest);
    onChange(merged);
  }

  // Paste an image from the clipboard anywhere within the form.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pasted: File[] = [];
      for (const item of items) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) pasted.push(f);
        }
      }
      if (pasted.length > 0) addFiles(pasted);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  return (
    <div className="field">
      <div className="field__row">
        <label className="field__label">
          Evidence{" "}
          <span className="field__hint" style={{ fontWeight: 400 }}>
            (optional · screenshots, logs)
          </span>
        </label>
        <span className="field__hint">
          {files.length}/{ATTACHMENT_LIMITS.maxFilesPerRequest}
        </span>
      </div>

      <div
        className="attach-drop"
        data-drag={dragOver ? "true" : "false"}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
        }}
      >
        <Icon.upload />
        <span>
          Drop files, paste an image, or <strong>browse</strong>
        </span>
        <span className="field__hint">
          Up to {ATTACHMENT_LIMITS.maxFilesPerRequest} files · 10 MB each · png/jpg/gif/webp/pdf/txt/json
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ATTACHMENT_LIMITS.allowedMime.join(",")}
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <div className="field__error">
          <Icon.alert /> {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="attach-list">
          {files.map((f, i) => (
            <PendingFileChip
              key={`${f.name}-${i}`}
              file={f}
              onRemove={() => onChange(files.filter((_, idx) => idx !== i))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PendingFileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!isImage(file.type)) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="attach-chip">
      <div className="attach-chip__thumb">
        {previewUrl ? (
          <img src={previewUrl} alt={file.name} />
        ) : (
          <Icon.file />
        )}
      </div>
      <div className="attach-chip__meta">
        <span className="attach-chip__name" title={file.name}>
          {file.name}
        </span>
        <span className="attach-chip__sub">{formatSize(file.size)}</span>
      </div>
      <button
        type="button"
        className="icon-btn"
        aria-label="Remove file"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <Icon.close />
      </button>
    </div>
  );
}

// Used on the BugDetail screen — fetches existing attachments, allows
// uploader-only delete, and supports adding more after the bug is filed.
export function AttachmentsPanel({
  bugId,
  currentUserId,
}: {
  bugId: number;
  currentUserId: number;
}) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [lightbox, setLightbox] = useState<Attachment | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listAttachments(bugId)
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

  async function handleUpload(fileList: FileList | File[]) {
    const files: File[] = [];
    for (const f of Array.from(fileList)) {
      const err = validateFile(f);
      if (err) {
        setError(err);
        return;
      }
      files.push(f);
    }
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const created = await api.uploadAttachments(bugId, files);
      setItems((prev) => [...prev, ...created]);
    } catch (err) {
      console.error(err);
      setError("Upload failed — please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(a: Attachment) {
    try {
      await api.deleteAttachment(a.id);
      setItems((prev) => prev.filter((x) => x.id !== a.id));
    } catch (err) {
      console.error(err);
      setError("Could not delete that file.");
    }
  }

  if (loading) {
    return (
      <div className="detail-section">
        <div className="detail-section__label">Evidence</div>
        <div className="dup-skeleton" style={{ height: 60 }} />
      </div>
    );
  }

  return (
    <div className="detail-section">
      <div className="detail-section__label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span>Evidence · {items.length}</span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{ marginLeft: "auto" }}
        >
          <Icon.upload /> {uploading ? "Uploading…" : "Add file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ATTACHMENT_LIMITS.allowedMime.join(",")}
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files) handleUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <div className="field__error" style={{ marginTop: 8 }}>
          <Icon.alert /> {error}
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ color: "var(--app-ink-muted)", fontSize: 13, marginTop: 4 }}>
          No files attached. Add screenshots or logs to help triage.
        </div>
      ) : (
        <div className="attach-grid">
          {items.map((a) => (
            <ExistingAttachment
              key={a.id}
              attachment={a}
              canDelete={a.uploaderId === currentUserId}
              onDelete={() => handleDelete(a)}
              onPreview={() => setLightbox(a)}
            />
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="attach-lightbox"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-label={lightbox.filename}
        >
          <img src={api.attachmentUrl(lightbox.id)} alt={lightbox.filename} />
        </div>
      )}
    </div>
  );
}

function ExistingAttachment({
  attachment,
  canDelete,
  onDelete,
  onPreview,
}: {
  attachment: Attachment;
  canDelete: boolean;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const url = api.attachmentUrl(attachment.id);
  const image = isImage(attachment.mimeType);

  return (
    <div className="attach-card">
      <div
        className="attach-card__thumb"
        onClick={image ? onPreview : undefined}
        style={{ cursor: image ? "zoom-in" : "default" }}
      >
        {image ? (
          <img src={url} alt={attachment.filename} loading="lazy" />
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            style={{ display: "grid", placeItems: "center", height: "100%" }}
          >
            <Icon.file />
          </a>
        )}
      </div>
      <div className="attach-card__meta">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="attach-card__name"
          title={attachment.filename}
        >
          {attachment.filename}
        </a>
        <span className="attach-card__sub">
          {formatSize(attachment.sizeBytes)} · {attachment.uploaderName}
        </span>
      </div>
      {canDelete && (
        <button
          type="button"
          className="icon-btn attach-card__delete"
          aria-label="Delete file"
          title="Delete"
          onClick={onDelete}
        >
          <Icon.close />
        </button>
      )}
    </div>
  );
}
