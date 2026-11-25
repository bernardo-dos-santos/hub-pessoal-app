import { useSyncExternalStore } from 'react';
import { getSystemHealthVersion, subscribeSystemHealth } from '../health/systemHealth';
import { getHubAlerts } from './alertRegistry';
import { type HubAlert } from './alert-types';

/**
 * Alertas de todos os providers. Assina a saúde do sistema porque ela é o
 * único dado de alerta que chega depois do primeiro render (vem de um fetch);
 * o resto já está no storage na hora de desenhar.
 */
export function useHubAlerts(): HubAlert[] {
  useSyncExternalStore(subscribeSystemHealth, getSystemHealthVersion);
  return getHubAlerts();
}
