// ──────────────────────────────────────────────
// QR Token Signing & Verification
// Uses HMAC-SHA256 via the `jose` library for
// compact, tamper-proof QR tokens.
// ──────────────────────────────────────────────

import { SignJWT, jwtVerify } from "jose";

const getSecret = () => {
  const secret = process.env.QR_SIGNING_SECRET || "default_development_secret_32_characters_long_min";
  return new TextEncoder().encode(secret);
};

/**
 * Generate a pass code from a counter value.
 * Format: HL-0001, HL-0002, etc.
 */
export function generatePassCode(counter: number): string {
  return `HL-${String(counter).padStart(4, "0")}`;
}

/**
 * Sign a pass code into a compact JWS token for QR embedding.
 * The token encodes the pass code and a timestamp, signed with HMAC-SHA256.
 */
export async function signQrToken(passCode: string): Promise<string> {
  const token = await new SignJWT({ pc: passCode })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("hrudhayam")
    .sign(getSecret());

  return token;
}

/**
 * Verify a QR token and extract the pass code.
 * Returns the pass code if valid, throws if tampered or invalid.
 */
export async function verifyQrToken(
  token: string
): Promise<{ passCode: string }> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: "hrudhayam",
    });

    const passCode = payload.pc as string;
    if (!passCode) {
      throw new Error("Invalid token: missing pass code");
    }

    return { passCode };
  } catch {
    throw new Error("Invalid or tampered QR token");
  }
}
