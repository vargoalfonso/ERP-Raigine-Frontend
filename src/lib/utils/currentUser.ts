import { getCookiesFromBrowser } from "@/lib/api/instance";
import { PayloadToken } from "@/types";
import { jwtDecode } from "jwt-decode";

export const getCurrentUserDisplayName = (): string | null => {
  if (typeof document === "undefined") return null;

  const token = getCookiesFromBrowser("Authorization");
  if (!token) return null;

  try {
    const decoded = jwtDecode<PayloadToken>(token);

    const candidates = [
      decoded.full_name,
      decoded.email,
      decoded.userId,
      decoded.id,
      decoded.sub,
    ];

    for (const value of candidates) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  } catch {
    return null;
  }

  return null;
};