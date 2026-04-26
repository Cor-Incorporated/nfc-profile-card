export interface ImageQualityResult {
  width: number;
  height: number;
  warnings: string[];
}

export interface EnhancedImageResult {
  dataUrl: string;
  base64: string;
  mimeType: string;
}

const RECOMMENDED_MIN_SIDE = 1000;
const MIN_BUSINESS_CARD_RATIO = 1.35;
const MAX_BUSINESS_CARD_RATIO = 1.95;

function loadImageFromSource(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl =
      typeof source === "string" ? null : URL.createObjectURL(source);

    img.onload = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      resolve(img);
    };
    img.onerror = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      reject(new Error("Failed to load image"));
    };
    img.src = objectUrl || (source as string);
  });
}

export async function inspectBusinessCardImage(
  file: File,
  t: (key: string) => string,
): Promise<ImageQualityResult> {
  const img = await loadImageFromSource(file);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  const ratio = longSide / Math.max(shortSide, 1);
  const warnings: string[] = [];

  if (longSide < RECOMMENDED_MIN_SIDE || shortSide < 600) {
    warnings.push(t("imageQualityLowResolution"));
  }

  if (ratio < MIN_BUSINESS_CARD_RATIO || ratio > MAX_BUSINESS_CARD_RATIO) {
    warnings.push(t("imageQualityAspectRatio"));
  }

  return { width, height, warnings };
}

export async function enhanceBusinessCardImage(
  dataUrl: string,
): Promise<EnhancedImageResult> {
  const img = await loadImageFromSource(dataUrl);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    throw new Error("Canvas is unavailable");
  }

  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.filter = "contrast(1.18) brightness(1.06) saturate(0.92)";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const average = (data[index] + data[index + 1] + data[index + 2]) / 3;
    const boost = average > 210 ? 10 : average < 80 ? -8 : 0;
    data[index] = Math.max(0, Math.min(255, data[index] + boost));
    data[index + 1] = Math.max(0, Math.min(255, data[index + 1] + boost));
    data[index + 2] = Math.max(0, Math.min(255, data[index + 2] + boost));
  }

  ctx.filter = "none";
  ctx.putImageData(imageData, 0, 0);

  const enhancedDataUrl = canvas.toDataURL("image/jpeg", 0.9);
  return {
    dataUrl: enhancedDataUrl,
    base64: enhancedDataUrl.split(",")[1],
    mimeType: "image/jpeg",
  };
}
