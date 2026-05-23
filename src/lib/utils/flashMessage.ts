export type FlashMessageType = "success" | "error" | "warning" | "info";

export type FlashMessage = {
  type: FlashMessageType;
  content: string;
  targetPath?: string;
};

const FLASH_MESSAGE_STORAGE_KEY = "mrp-erp:flash-message";

export const setFlashMessage = (value: FlashMessage) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(FLASH_MESSAGE_STORAGE_KEY, JSON.stringify(value));
};

export const consumeFlashMessage = (targetPath?: string): FlashMessage | null => {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(FLASH_MESSAGE_STORAGE_KEY);
  if (!raw) return null;

  window.sessionStorage.removeItem(FLASH_MESSAGE_STORAGE_KEY);

  try {
    const parsed = JSON.parse(raw) as FlashMessage;
    if (targetPath && parsed.targetPath && parsed.targetPath !== targetPath) {
      window.sessionStorage.setItem(FLASH_MESSAGE_STORAGE_KEY, raw);
      return null;
    }
    if (!parsed || typeof parsed.content !== "string" || !parsed.content.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
};
