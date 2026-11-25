import React, { useEffect } from 'react';

const DEFAULT_XTDS_URL = 'http://localhost:3003';
const SCRIPT_ID = 'xtds-field-monitor-script';

interface FieldMonitorBridgeProps {
  view?: string;
}

export const FieldMonitorBridge: React.FC<FieldMonitorBridgeProps> = ({ view }) => {
  const baseUrl = (import.meta.env.VITE_XTDS_URL || DEFAULT_XTDS_URL).replace(/\/+$/, '');
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
