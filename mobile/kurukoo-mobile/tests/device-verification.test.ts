import { describe, expect, it } from "vitest";

import { parseDeviceVerificationState } from "../lib/device-verification";

describe("first-launch device verification", () => {
  it("accepts only explicit completion states", () => {
    expect(parseDeviceVerificationState("verified")).toBe("verified");
    expect(parseDeviceVerificationState("not-provider")).toBe("not-provider");
  });

  it("fails closed for missing, malformed, or invented states", () => {
    expect(parseDeviceVerificationState(null)).toBeNull();
    expect(parseDeviceVerificationState("pending")).toBeNull();
    expect(parseDeviceVerificationState("true")).toBeNull();
    expect(parseDeviceVerificationState("{}")) .toBeNull();
  });
});
