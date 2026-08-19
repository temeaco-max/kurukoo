import { describe, expect, it } from "vitest";
import { SimulatedOtpProvider } from "../lib/simulated-otp-provider";

const simulatedOtpEnabled = process.env.KURUKOO_SIMULATED_OTP === "1";

describe.skipIf(!simulatedOtpEnabled)("sandbox simulated device-verification integration", () => {
  it("completes request, code confirmation, and one-time invalidation", () => {
    const provider = new SimulatedOtpProvider();
    const delivery = provider.issue("alex@example.com");
    expect(delivery.provider).toBe("sandbox-simulated");
    expect(delivery.delivered).toBe(true);
    expect(provider.verify(delivery.email, "000000")).toEqual({ ok: false, reason: "invalid" });
    expect(provider.verify(delivery.email, delivery.code)).toEqual({ ok: true });
    expect(provider.verify(delivery.email, delivery.code)).toEqual({ ok: false, reason: "expired" });
  });
});
