import { detectImageType } from "@/lib/uploads/image-type";

/** Real file contents, not the type the browser claims: an image or a PDF. */
export function detectReceiptType(bytes: Uint8Array) {
  const image = detectImageType(bytes);

  if (image) return image;

  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return { mime: "application/pdf", ext: "pdf" };
  }

  return null;
}