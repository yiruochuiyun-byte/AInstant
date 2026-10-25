export const EMBED_DIM = 1024;
const MODEL = process.env.VOYAGE_MODEL ?? "voyage-3.5-lite";

/** Multilingual embeddings so a Chinese post and an English post about the same release land close together. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.VOYAGE_API_KEY}` },
    body: JSON.stringify({ input: texts, model: MODEL, input_type: "document", output_dimension: EMBED_DIM }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`voyage ${res.status}: ${await res.text()}`);
  const { data } = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  return data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
