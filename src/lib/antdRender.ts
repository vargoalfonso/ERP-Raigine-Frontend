"use client";

import { unstableSetRender } from "antd";
import { createRoot } from "react-dom/client";
import type { ReactElement } from "react";

unstableSetRender(
  (
    node: ReactElement,
    container: Element | DocumentFragment
  ) => {
    // reuse existing root if createRoot was already called for this container
    const key = "__rc_root__";
    let root = (container as any)[key] as ReturnType<typeof createRoot> | undefined;
    if (!root) {
      root = createRoot(container as Element);
      (container as any)[key] = root;
    }
    root.render(node);

    // return async unmount function
    return async () => {
      try {
        root!.unmount();
      } finally {
        try {
          delete (container as any)[key];
        } catch {}
      }
    };
  }
);
