import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initI18n } from "./i18n";
import { preloadAppImages } from "./utils/preloadImages";
import { ScrollLockProvider } from "./hooks/useScrollLock";

async function bootstrap(): Promise<void> {
  await initI18n();
  preloadAppImages();

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <ScrollLockProvider>
        <App />
      </ScrollLockProvider>
    </React.StrictMode>,
  );
}

void bootstrap();
