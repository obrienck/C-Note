import type { CNoteBridge } from './shared/types';

declare global {
  interface Window {
    cnote: CNoteBridge;
  }
}
