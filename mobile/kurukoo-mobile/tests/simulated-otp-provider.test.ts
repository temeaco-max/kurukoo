import { describe, expect, it } from "vitest";
import { SimulatedOtpProvider } from "../lib/simulated-otp-provider";

describe("sandbox simulated OTP provider", () => {
  it("issues a clearly simulated delivery and verifies the one-time code", () => {
    const provider = new SimulatedOtpProvider();
    const delivery = provider.issue(" Alex@Example.com ");
    expect(delivery).toEqual({ email: "alex@example.com", code: "246810", delivered: true, provider: "sandbox-simulated" });
    expect(provider.verify("alex@example.com", "246810")).toEqual({ ok: true });
    expect(provider.verify("alex@example.com", "246810")).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects an invalid code without consuming the valid code", () => {
    const provider = new SimulatedOtpProvider();
    provider.issue("alex@example.com");
    expect(provider.verify("alex@example.com", "000000")).toEqual({ ok: false, reason: "invalid" });
    expect(provider.verify("alex@example.com", "246810")).toEqual({ ok: true });
  });
});
