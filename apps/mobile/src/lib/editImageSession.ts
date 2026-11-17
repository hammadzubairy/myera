import type { PickedImage } from './photos';

type Resolver = (result: PickedImage | null) => void;

let resolver: Resolver | null = null;

/** Register a waiter before navigating to `/edit-image`. */
export function beginEditImageSession(): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    resolver?.(null);
    resolver = resolve;
  });
}

export function completeEditImageSession(result: PickedImage | null) {
  const r = resolver;
  resolver = null;
  r?.(result);
}

export function cancelEditImageSession() {
  completeEditImageSession(null);
}
