import { describe, expect, it } from "vitest";
import i18n, { changeLanguage, initI18n } from "../i18n";

describe("i18n lazy loading", () => {
  it("loads a language bundle and switches the active language", async () => {
    await changeLanguage("fr");

    expect(i18n.language).toBe("fr");
    expect(i18n.t("app.loading")).not.toBe("app.loading");
  });

  it("rejects unsupported languages", async () => {
    await expect(changeLanguage("xx")).rejects.toThrow("Unsupported language");
  });

  it("initializes with the language stored in localStorage", async () => {
    localStorage.setItem("ottavada-lang", "es");
    await initI18n();

    expect(i18n.language).toBe("es");
    expect(i18n.t("app.loading")).not.toBe("app.loading");
  });
});
