// Photos are shrunk in the browser before upload (docs/blueprint.md "Adding a
// product"): phone cameras produce 3–8 MB images, which are slow on mobile
// data — and in this mockup would not fit in browser storage.

export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";

/** The photo drawn onto a canvas, longest side at most `maxSide` px. Rejects files that aren't images. */
function drawShrunk(file: File, maxSide: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("not an image"));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!context) {
        reject(new Error("canvas unavailable"));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable image"));
    };
    image.src = url;
  });
}

/** Longest side at most `maxSide` px, re-encoded as JPEG, as a data URL (the mockups keep photos this way). */
export async function compressImage(file: File, maxSide = 1600, quality = 0.8): Promise<string> {
  return (await drawShrunk(file, maxSide)).toDataURL("image/jpeg", quality);
}

/**
 * The same shrink, as a JPEG file ready to upload (the API takes at most
 * 2 MB). A photo that would still be too big is tried again smaller.
 * Straight from the canvas: turning a data URL back into a file with fetch()
 * is blocked by the site's Content-Security-Policy (connect-src).
 */
export async function compressImageToBlob(file: File, maxSide = 1600, quality = 0.8): Promise<Blob> {
  const canvas = await drawShrunk(file, maxSide);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("couldn't encode the photo");
  if (blob.size <= MAX_UPLOAD_BYTES || maxSide <= 640) return blob;
  return compressImageToBlob(file, Math.round(maxSide * 0.75), quality);
}

/** The API's limit (apps/api files/photos.ts MAX_PHOTO_BYTES). */
const MAX_UPLOAD_BYTES = 2_000_000;
