// Splits the model registry into the dot plot's panels. Kept apart from the component so tests can import it.
import type { ModelPoint } from "./queries.ts";

/** Models released this recently are drawn in the accent color. */
export const NEW_DAYS = 30;

export type Panel = { key: string; points: { m: ModelPoint; y: number }[]; undated: number };

export function panels(models: ModelPoint[]): Panel[] {
  const pick = (key: string, modality: string, score: (m: ModelPoint) => number | null): Panel => {
    const rows = models.filter((m) => m.modality === modality && score(m) != null);
    return {
      key,
      points: rows.filter((m) => m.released_on).map((m) => ({ m, y: score(m)! })),
      undated: rows.filter((m) => !m.released_on).length,
    };
  };
  return [
    pick("language", "language", (m) => m.score),
    pick("agents", "language", (m) => m.agentic_score),
    pick("video", "video", (m) => m.score),
    pick("image", "image", (m) => m.score),
    pick("voice", "voice", (m) => m.score),
  ].filter((p) => p.points.length > 0);
}

