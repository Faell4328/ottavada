import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";

import { AppProvider } from "../../context/AppContext";

export function renderWithAppProvider(ui: ReactElement, options?: RenderOptions) {
  return render(<AppProvider disableBootstrap>{ui}</AppProvider>, options);
}
