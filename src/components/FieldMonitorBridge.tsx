import React, { useEffect } from 'react';

const SCRIPT_ID = 'xtds-field-monitor-script';

function resolveXtdsBaseUrl(): string {
  const configured = (import.meta.env.VITE_XTDS_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:3003`;
  }
  return 'http://localhost:3003';
}

interface FieldMonitorBridgeProps {
  view?: string;
}

export const FieldMonitorBridge: React.FC<FieldMonitorBridgeProps> = ({ view }) => {
  const baseUrl = resolveXtdsBaseUrl();
  const scriptSrc = `${baseUrl}/widget/field-monitor.js`;
  const endpoint = `${baseUrl}/api/field-monitor`;

  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = scriptSrc;
    script.defer = true;
    document.head.appendChild(script);
  }, [scriptSrc]);

  return (
    <xtds-field-monitor
      app="formae"
      endpoint={endpoint}
      trigger-selector="[data-field-monitor-trigger]"
      hold-ms="550"
      view={view}
    />
  );
};
