"use client";

import { unstableSetRender } from "antd";
import { createRoot } from "react-dom/client";
import type { ReactElement } from "react";

unstableSetRender(
  (
    node: ReactElement,
    container: Element | DocumentFragment
  ) => {
    const root = createRoot(container);
    root.render(node);

    // ✅ HARUS return Promise<void>
    return async () => {
      root.unmount();
    };
  }
);
