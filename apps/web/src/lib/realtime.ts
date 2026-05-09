import type { Bug } from "../types";

export type RealtimeEvent =
  | { type: "bug.created"; bug: Bug }
  | { type: "bug.updated"; bug: Bug };

type Listener = (event: RealtimeEvent) => void;

const listeners = new Set<Listener>();
let source: EventSource | null = null;

const TYPES: RealtimeEvent["type"][] = ["bug.created", "bug.updated"];

export function startRealtime(): void {
  if (source) return;
  source = new EventSource("/api/events", { withCredentials: true });
  for (const type of TYPES) {
    source.addEventListener(type, (e) => {
      try {
        const bug = JSON.parse((e as MessageEvent).data) as Bug;
        for (const l of listeners) l({ type, bug });
      } catch (err) {
        console.error("Failed to parse realtime event:", err);
      }
    });
  }
  source.addEventListener("error", () => {
    // EventSource auto-reconnects on transient errors. We log only to surface
    // persistent issues during development.
    if (source && source.readyState === EventSource.CLOSED) {
      console.warn("realtime stream closed; will not reconnect");
    }
  });
}

export function stopRealtime(): void {
  if (!source) return;
  source.close();
  source = null;
}

export function onRealtime(handler: Listener): () => void {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}
