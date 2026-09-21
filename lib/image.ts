// Client-side only: downscales and JPEG-compresses a photo before it's sent
// to the server, keeping it well under Vercel's 4.5MB request body limit and
// Anthropic's recommended max image dimension.

export interface CompressedImage {
  mediaType: string;
  data: string; // base64, no data URL prefix
  previewUrl: string; // full data URL, for an <img> preview
}

const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 0.82;

export async function compressImageFile(file: File): Promise<CompressedImage> {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  let { width, height } = img;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser");
  ctx.drawImage(img, 0, 0, width, height);

  const previewUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const data = previewUrl.split(",")[1] ?? "";
  return { mediaType: "image/jpeg", data, previewUrl };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = src;
  });
}
