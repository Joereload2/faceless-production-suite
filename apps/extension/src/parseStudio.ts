export type StudioRow = {
  videoId: string;
  title: string;
  views?: number;
  vph?: number;
  subscribers: number | null;
};

const VIDEO_RE = /\/video\/([A-Za-z0-9_-]{6,20})/;
const NUM_RE = /([\d,.]+)/;

function parseNumber(raw: string): number | undefined {
  const m = raw.replace(/,/g, "").match(NUM_RE);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

export function parseStudioHtml(html: string): StudioRow[] {
  const chunks = html.split(/<tr\b/i).slice(1);
  const rows: StudioRow[] = [];
  for (const chunk of chunks) {
    const href = chunk.match(/href="([^"]*\/video\/[^"]+)"/i);
    const hrefVal = href?.[1];
    if (!hrefVal) continue;
    const idm = hrefVal.match(VIDEO_RE);
    if (!idm?.[1]) continue;
    const titleM = chunk.match(/<a[^>]*href="[^"]*\/video\/[^"]+"[^>]*>([^<]*)<\/a>/i);
    const title = (titleM?.[1] ?? "").trim();
    const viewsM = chunk.match(/([\d,.]+)\s*views/i);
    const vphM = chunk.match(/([\d,.]+)\s*(?:\/hour|views\/hour)/i);
    const subM = chunk.match(/([\d,.]+)\s*subscribers/i);
    rows.push({
      videoId: idm[1],
      title,
      views: viewsM ? parseNumber(viewsM[1]) : parseNumber(chunk),
      vph: vphM ? parseNumber(vphM[1]) : undefined,
      subscribers: subM ? parseNumber(subM[1]) ?? null : null,
    });
  }
  return rows;
}

export function ratio(views: number | undefined, subscribers: number | null): number | null {
  if (subscribers == null || subscribers <= 0 || views == null) return null;
  return views / subscribers;
}
