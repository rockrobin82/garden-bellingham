import "server-only";

import QRCode from "qrcode";

/**
 * Generates a PNG QR code image for the given payload.
 */
export async function generateQrPng(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 256,
  });
}
