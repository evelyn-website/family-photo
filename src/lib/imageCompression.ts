/**
 * Client-side image compression utilities using Canvas API
 */

export interface ImageVersions {
  thumbnail: Blob;
  medium: Blob;
  original: File; // The actual uploaded file, completely untouched
}

export interface CompressionOptions {
  maxDimension: number;
  quality: number;
  mimeType?: string;
}

/**
 * Calculate new dimensions while preserving aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxDimension: number
): { width: number; height: number } {
  // If image is already smaller than max, keep original dimensions
  if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
    return { width: originalWidth, height: originalHeight };
  }

  const aspectRatio = originalWidth / originalHeight;

  if (originalWidth > originalHeight) {
    // Landscape
    return {
      width: maxDimension,
      height: Math.round(maxDimension / aspectRatio),
    };
  } else {
    // Portrait or square
    return {
      width: Math.round(maxDimension * aspectRatio),
      height: maxDimension,
    };
  }
}

/**
 * Step-down scaling for better quality when reducing large images
 * Scales in ~50% steps to avoid artifacts from large single-step reductions
 */
function stepDownResize(
  img: HTMLImageElement | HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  let currentWidth = img.width;
  let currentHeight = img.height;
  let source: HTMLImageElement | HTMLCanvasElement = img;

  // Scale down in steps of ~50% until we're close to target
  while (
    currentWidth * 0.5 > targetWidth ||
    currentHeight * 0.5 > targetHeight
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(currentWidth * 0.5);
    canvas.height = Math.round(currentHeight * 0.5);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      break;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    source = canvas;
    currentWidth = canvas.width;
    currentHeight = canvas.height;
  }

  // Final resize to exact target dimensions
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = targetWidth;
  finalCanvas.height = targetHeight;
  const ctx = finalCanvas.getContext("2d");
  if (!ctx) {
    // Fallback: return a canvas with the image as-is
    const fallbackCanvas = document.createElement("canvas");
    fallbackCanvas.width = targetWidth;
    fallbackCanvas.height = targetHeight;
    return fallbackCanvas;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

  return finalCanvas;
}

/**
 * Compress an image file to a specific size and quality
 */
export async function compressImage(
  file: File,
  options: CompressionOptions
): Promise<Blob> {
  const { maxDimension, quality, mimeType = "image/jpeg" } = options;

  return new Promise((resolve, reject) => {
    // Validate file type upfront
    if (!file.type.startsWith("image/")) {
      reject(new Error("File is not an image"));
      return;
    }

    const img = new Image();
    // Use createObjectURL instead of FileReader (more efficient)
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      // Clean up object URL
      URL.revokeObjectURL(objectUrl);

      try {
        // Calculate new dimensions
        const { width, height } = calculateDimensions(
          img.width,
          img.height,
          maxDimension
        );

        // Use step-down scaling for better quality
        const canvas = stepDownResize(img, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to create blob"));
              return;
            }

            // If compressed version is larger than original, use original
            // (can happen with already-compressed small JPEGs)
            if (blob.size > file.size) {
              resolve(file);
            } else {
              resolve(blob);
            }
          },
          mimeType,
          quality
        );
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };

    // Load image from object URL
    img.src = objectUrl;
  });
}

/**
 * Generate compressed versions of an image (thumbnail, medium)
 * Plus the original untouched file for archival quality
 * Optimized for professional photography (DSLR, medium format film scans)
 */
export async function generateImageVersions(
  file: File
): Promise<ImageVersions> {
  // Validate file type
  if (!file.type.startsWith("image/")) {
    throw new Error("File must be an image");
  }

  // Determine mime type based on original file
  // Keep PNG as PNG to preserve transparency, otherwise use JPEG
  const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";

  // Generate thumbnail (~800px max, 0.82 quality)
  // For grid display on all devices including retina
  const thumbnailPromise = compressImage(file, {
    maxDimension: 800,
    quality: 0.82,
    mimeType,
  });

  // Generate medium (~2400px max, 0.90 quality)
  // For modal viewing - high quality but reasonable bandwidth
  const mediumPromise = compressImage(file, {
    maxDimension: 2400,
    quality: 0.9,
    mimeType,
  });

  const [thumbnail, medium] = await Promise.all([
    thumbnailPromise,
    mediumPromise,
  ]);

  return {
    thumbnail,
    medium,
    original: file, // Return the original file untouched for archival quality
  };
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
