"use client";

import { Suspense } from "react";
import SubConMaterialsClient from "./SubConMaterialsClient";

export default function SubConMaterialsPage() {
  return (
    <Suspense fallback={null}>
      <SubConMaterialsClient />
    </Suspense>
  );
}
