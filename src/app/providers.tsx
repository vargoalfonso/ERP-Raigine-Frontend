"use client";

import { store } from "@/lib/api/store";
import { Provider } from "react-redux";
import "@/lib/antdRender";

export function Providers({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
