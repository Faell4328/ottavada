import { getCurrentWindow } from "@tauri-apps/api/window";

export async function restoreMainWindow() {
  const window = getCurrentWindow();
  const [isMinimized, isMaximized] = await Promise.all([
    window.isMinimized(),
    window.isMaximized(),
  ]);

  if (isMinimized) {
    await window.unminimize();
  }

  await window.show();

  if (isMaximized) {
    await window.unmaximize();
    await window.maximize();
  }
}