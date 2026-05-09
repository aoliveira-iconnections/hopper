import { EventEmitter } from "node:events";
import type { Bug } from "../types";

export type BugEventType = "bug.created" | "bug.updated";

export interface BugEvent {
  type: BugEventType;
  bug: Bug;
}

const bus = new EventEmitter();
bus.setMaxListeners(0); // unbounded subscribers — one per active SSE connection

export function emitBugEvent(event: BugEvent): void {
  bus.emit("bug", event);
}

export function onBugEvent(handler: (event: BugEvent) => void): () => void {
  bus.on("bug", handler);
  return () => {
    bus.off("bug", handler);
  };
}
