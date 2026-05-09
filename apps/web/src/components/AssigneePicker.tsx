import { useEffect, useState } from "react";
import { Avatar } from "./ui";
import { api } from "../lib/api";
import type { User, UserSummary } from "../types";

export function AssigneePicker({
  assignee,
  onChange,
}: {
  assignee: UserSummary | null;
  onChange: (assigneeId: number | null) => void | Promise<void>;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || users.length > 0) return;
    api.listUsers().then(setUsers).catch(() => setUsers([]));
  }, [open, users.length]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".assignee-picker")) setOpen(false);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="assignee-picker">
      <button
        type="button"
        className="assignee-picker__trigger"
        onClick={() => setOpen((v) => !v)}
      >
        {assignee ? (
          <>
            <Avatar name={assignee.name} size="sm" />
            <span>{assignee.name}</span>
          </>
        ) : (
          <span className="assignee-picker__placeholder">Unassigned</span>
        )}
      </button>
      {open && (
        <div className="assignee-picker__menu" role="listbox">
          <button
            type="button"
            className="assignee-picker__item"
            onClick={() => {
              setOpen(false);
              onChange(null);
            }}
          >
            <span className="assignee-picker__placeholder">Unassigned</span>
          </button>
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              className={`assignee-picker__item ${assignee?.id === u.id ? "is-selected" : ""}`}
              onClick={() => {
                setOpen(false);
                onChange(u.id);
              }}
            >
              <Avatar name={u.name} size="sm" />
              <div className="assignee-picker__meta">
                <span className="assignee-picker__name">{u.name}</span>
                <span className="assignee-picker__role">{u.role}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
