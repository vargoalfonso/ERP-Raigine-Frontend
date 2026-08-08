// [session-expiry] Bus sederhana untuk memberi tahu UI bahwa sesi login habis
// (HTTP 401) sehingga aplikasi menampilkan modal "login kembali" alih-alih
// langsung melakukan redirect ke halaman login.

let expired = false;
const listeners = new Set<() => void>();

export function isSessionExpired(): boolean {
  return expired;
}

export function notifySessionExpired(): void {
  if (expired) return;
  expired = true;
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore
    }
  });
}

export function resetSessionExpired(): void {
  expired = false;
}

export function subscribeSessionExpired(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
