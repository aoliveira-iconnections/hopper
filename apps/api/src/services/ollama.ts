const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://ollama:11434";
const GEN_MODEL = process.env.OLLAMA_GEN_MODEL ?? "llama3.2:3b";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

const MAX_EMBED_CHARS = 8000;

async function ollamaFetch(path: string, body: unknown, signal?: AbortSignal) {
  const res = await fetch(`${OLLAMA_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama ${path} ${res.status}: ${text}`);
  }
  return res;
}

async function listModels(): Promise<string[]> {
  const res = await fetch(`${OLLAMA_URL}/api/tags`);
  if (!res.ok) throw new Error(`Ollama /api/tags ${res.status}`);
  const data = (await res.json()) as { models: { name: string }[] };
  return data.models.map((m) => m.name);
}

async function pullModel(name: string) {
  console.log(`[ollama] pulling ${name} …`);
  const res = await ollamaFetch("/api/pull", { name, stream: true });
  const reader = res.body?.getReader();
  if (!reader) {
    console.log(`[ollama] pulled ${name}`);
    return;
  }
  const decoder = new TextDecoder();
  let buf = "";
  let lastStatus = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const evt = JSON.parse(line) as { status?: string; error?: string };
        if (evt.error) throw new Error(evt.error);
        if (evt.status && evt.status !== lastStatus) {
          lastStatus = evt.status;
          console.log(`[ollama]   ${name}: ${evt.status}`);
        }
      } catch {
        // ignore non-JSON lines
      }
    }
  }
  console.log(`[ollama] pulled ${name}`);
}

export async function ensureModelsPulled() {
  const required = [GEN_MODEL, EMBED_MODEL];
  const installed = await listModels();
  const installedSet = new Set(installed);
  const baseNames = new Set(installed.map((n) => n.split(":")[0]));
  for (const m of required) {
    const baseName = m.split(":")[0];
    if (installedSet.has(m) || baseNames.has(baseName)) continue;
    await pullModel(m);
  }
}

export async function embed(text: string): Promise<number[]> {
  const truncated = text.length > MAX_EMBED_CHARS ? text.slice(0, MAX_EMBED_CHARS) : text;
  const res = await ollamaFetch("/api/embeddings", {
    model: EMBED_MODEL,
    prompt: truncated,
  });
  const data = (await res.json()) as { embedding: number[] };
  if (!data.embedding || !Array.isArray(data.embedding)) {
    throw new Error("Ollama returned no embedding");
  }
  return data.embedding;
}

export async function generate(
  prompt: string,
  opts: { temperature?: number; maxTokens?: number; format?: "json" } = {},
): Promise<string> {
  const res = await ollamaFetch("/api/generate", {
    model: GEN_MODEL,
    prompt,
    stream: false,
    format: opts.format,
    options: {
      temperature: opts.temperature ?? 0.2,
      num_predict: opts.maxTokens ?? 200,
    },
  });
  const data = (await res.json()) as { response: string };
  return data.response.trim();
}

export function vectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
