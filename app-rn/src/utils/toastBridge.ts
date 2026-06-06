type ToastKind = 'success' | 'error' | 'info';

// Module-level bridge so non-React code (the axios interceptor) can show a
// toast. ToastProvider registers its handler on mount.
let handler: ((message: string, kind: ToastKind) => void) | null = null;

export function setToastHandler(fn: ((message: string, kind: ToastKind) => void) | null) {
  handler = fn;
}

export function showToast(message: string, kind: ToastKind = 'info') {
  handler?.(message, kind);
}
