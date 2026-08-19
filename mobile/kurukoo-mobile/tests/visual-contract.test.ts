import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { KURUKOO_MARK_PATH, KURUKOO_VISUAL_TOKENS } from "../lib/visual-contract";

const themeSource = readFileSync(resolve(process.cwd(), "theme.config.js"), "utf8");

describe("Kurukoo visual contract", () => {
  it("keeps the authoritative warm brand tokens", () => {
    expect(KURUKOO_VISUAL_TOKENS.primary).toBe("#B95D3C");
    expect(KURUKOO_VISUAL_TOKENS.background).toBe("#F7F2EC");
    expect(KURUKOO_VISUAL_TOKENS.foreground).toBe("#24221F");
    expect(KURUKOO_VISUAL_TOKENS.border).toBe("#E6DED5");
    expect(KURUKOO_VISUAL_TOKENS.success).toBe("#2E8060");
    expect(KURUKOO_VISUAL_TOKENS.warning).toBe("#B87928");
    expect(KURUKOO_VISUAL_TOKENS.error).toBe("#B5483D");
    expect(KURUKOO_VISUAL_TOKENS.info).toBe("#3C6F91");
  });

  it("keeps the runtime theme authority aligned", () => {
    expect(themeSource).toContain("primary: { light: '#B95D3C'");
    expect(themeSource).toContain("background: { light: '#F7F2EC'");
    expect(themeSource).toContain("foreground: { light: '#24221F'");
    expect(themeSource).toContain("border: { light: '#E6DED5'");
    expect(themeSource).toContain("success: { light: '#2E8060'");
    expect(themeSource).toContain("warning: { light: '#B87928'");
  });

  it("uses the intended typography family names", () => {
    expect(KURUKOO_VISUAL_TOKENS.bodyFont).toBe("Inter");
    expect(KURUKOO_VISUAL_TOKENS.headingFont).toBe("Space Grotesk");
  });

  it("uses the exact authoritative Kurukoo mark asset", () => {
    expect(KURUKOO_MARK_PATH).toBe("assets/images/kurukoo-logo.png");
  });
});
