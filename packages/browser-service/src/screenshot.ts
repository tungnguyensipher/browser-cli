import sharp from "sharp";

export const DEFAULT_BROWSER_SCREENSHOT_MAX_SIDE = 2000;
export const DEFAULT_BROWSER_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_REDUCE_QUALITY_STEPS = [90, 80, 70, 60, 50, 40, 30];

function buildImageResizeSideGrid(maxSide: number, start: number): number[] {
  const seen = new Set<number>();
  const values: number[] = [];
  for (let side = Math.min(maxSide, start); side >= 320; side = Math.floor(side * 0.85)) {
    const rounded = Math.max(1, Math.round(side));
    if (!seen.has(rounded)) {
      seen.add(rounded);
      values.push(rounded);
    }
  }
  if (!seen.has(maxSide)) {
    values.unshift(maxSide);
  }
  return values;
}

export async function normalizeBrowserScreenshot(
  buffer: Buffer,
  opts?: {
    maxSide?: number;
    maxBytes?: number;
  },
): Promise<{ buffer: Buffer; contentType?: "image/jpeg" }> {
  const maxSide = Math.max(1, Math.round(opts?.maxSide ?? DEFAULT_BROWSER_SCREENSHOT_MAX_SIDE));
  const maxBytes = Math.max(1, Math.round(opts?.maxBytes ?? DEFAULT_BROWSER_SCREENSHOT_MAX_BYTES));

  const meta = await sharp(buffer).metadata();
  const width = Number(meta.width ?? 0);
  const height = Number(meta.height ?? 0);
  const maxDim = Math.max(width, height);

  if (buffer.byteLength <= maxBytes && (maxDim === 0 || (width <= maxSide && height <= maxSide))) {
    return { buffer };
  }

  const sideStart = maxDim > 0 ? Math.min(maxSide, maxDim) : maxSide;
  const sideGrid = buildImageResizeSideGrid(maxSide, sideStart);
  let smallest: { buffer: Buffer; size: number } | null = null;

  for (const side of sideGrid) {
    for (const quality of IMAGE_REDUCE_QUALITY_STEPS) {
      const out = await sharp(buffer)
        .resize({
          width: width >= height ? side : undefined,
          height: height > width ? side : undefined,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      if (!smallest || out.byteLength < smallest.size) {
        smallest = { buffer: out, size: out.byteLength };
      }
      if (out.byteLength <= maxBytes) {
        return { buffer: out, contentType: "image/jpeg" };
      }
    }
  }

  const best = smallest?.buffer ?? buffer;
  throw new Error(
    `Browser screenshot could not be reduced below ${(maxBytes / (1024 * 1024)).toFixed(0)}MB (got ${(best.byteLength / (1024 * 1024)).toFixed(2)}MB)`,
  );
}
