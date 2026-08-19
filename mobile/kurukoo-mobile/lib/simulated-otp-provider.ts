/**
 * Sandbox-only OTP provider used by deterministic tests.
 * This module is intentionally not imported by production auth transport.
 */
export type SimulatedOtpDelivery = {
  email: string;
  code: string;
  delivered: boolean;
  provider: "sandbox-simulated";
};

export class SimulatedOtpProvider {
  private readonly codes = new Map<string, string>();

  issue(email: string): SimulatedOtpDelivery {
    const normalized = email.trim().toLowerCase();
    const code = "246810";
    this.codes.set(normalized, code);
    return { email: normalized, code, delivered: true, provider: "sandbox-simulated" };
  }

  verify(email: string, code: string): { ok: true } | { ok: false; reason: "invalid" | "expired" } {
    const normalized = email.trim().toLowerCase();
    const expected = this.codes.get(normalized);
    if (!expected) return { ok: false, reason: "expired" };
    if (expected !== code.trim()) return { ok: false, reason: "invalid" };
    this.codes.delete(normalized);
    return { ok: true };
  }
}
