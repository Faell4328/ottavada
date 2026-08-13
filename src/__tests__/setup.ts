import "@testing-library/jest-dom/vitest";
import { initI18n } from "../i18n";

localStorage.setItem("ottavada-lang", "pt");
await initI18n();
