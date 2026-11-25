/// <reference types="vite/client" />

import type React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'xtds-field-monitor': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        app?: string;
        endpoint?: string;
        view?: string;
        position?: 'bottom-right' | 'bottom-left' | 'inline';
        trigger?: 'hidden' | 'button';
        'trigger-selector'?: string;
        'hold-ms'?: string | number;
      };
    }
  }
}
