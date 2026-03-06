import { notFound } from "next/navigation";
import SmokeClient from "./SmokeClient";

export default function ApiSmokePage() {
  const smokeEnabled = process.env.ENABLE_API_SMOKE === "true";
  if (!smokeEnabled) notFound();
  return <SmokeClient />;
}
