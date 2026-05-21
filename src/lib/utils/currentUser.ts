import { getCookiesFromBrowser } from "@/lib/api/instance";
import { PayloadToken } from "@/types";
import { jwtDecode } from "jwt-decode";

export interface CurrentUserProfile {
  displayName: string | null;
  role: string | null;
  initials: string;
}

const getTokenPayload = (): PayloadToken | null => {
  if (typeof document === "undefined") return null;

  const token = getCookiesFromBrowser("Authorization");
  if (!token) return null;

  try {
    return jwtDecode<PayloadToken>(token);
  } catch {
    return null;
  }
};

export const getCurrentUserTokenPayload = (): PayloadToken | null => getTokenPayload();

export const getCurrentUserUid = (): string | null => {
  const decoded = getTokenPayload();
  if (!decoded) return null;
  if (typeof decoded.uid === "string" && decoded.uid.trim()) return decoded.uid.trim();
  if (typeof decoded.sub === "string" && decoded.sub.trim()) return decoded.sub.trim();
  return null;
};

const getInitials = (value: string | null): string => {
  if (!value) return "AI";

  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "AI";
};

export const getCurrentUserDisplayName = (): string | null => {
  const decoded = getTokenPayload();
  if (!decoded) return null;

  const candidates = [
    decoded.username,
    decoded.user_name,
    decoded.preferred_username,
    decoded.uid,
    decoded.name,
    decoded.full_name,
    decoded.email,
    decoded.sub,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

export const getCurrentUserRole = (): string | null => {
  const decoded = getTokenPayload();
  if (!decoded?.role || !decoded.role.trim()) return null;

  return decoded.role.trim();
};

export const getCurrentUserProfile = (): CurrentUserProfile => {
  const displayName = getCurrentUserDisplayName();
  const role = getCurrentUserRole();

  return {
    displayName,
    role,
    initials: getInitials(displayName),
  };
};