// ──────────────────────────────────────────────
// QR Code Generation (server-side)
// ──────────────────────────────────────────────

import QRCode from "qrcode";

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
}

/**
 * Generate a QR code as a PNG Buffer (for PDF embedding and email attachments).
 */
export async function generateQrPngBuffer(
  text: string,
  options?: QRCodeOptions
): Promise<Buffer> {
  return await QRCode.toBuffer(text, {
    type: "png",
    width: options?.width ?? 300,
    margin: options?.margin ?? 2,
    errorCorrectionLevel: options?.errorCorrectionLevel ?? "H",
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}

/**
 * Generate a QR code as a base64 Data URL (for inline <img> in emails).
 */
export async function generateQrDataUrl(
  text: string,
  options?: QRCodeOptions
): Promise<string> {
  return await QRCode.toDataURL(text, {
    width: options?.width ?? 300,
    margin: options?.margin ?? 2,
    errorCorrectionLevel: options?.errorCorrectionLevel ?? "H",
  });
}
