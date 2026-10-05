export type AlertSeverity = 'info' | 'warning' | 'critical';

export type HubAlert = {
  id: string;
  moduleId: string;
  severity: AlertSeverity;
  title: string;
  description?: string;
  actionLabel?: string;
  actionRoute?: string;
};

export type AlertProvider = {
  getAlerts(): HubAlert[];
};
