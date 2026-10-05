import { getHubAlerts } from './alertRegistry';
import { type HubAlert } from './alert-types';

export function useHubAlerts(): HubAlert[] {
  return getHubAlerts();
}
