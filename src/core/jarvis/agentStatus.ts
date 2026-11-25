import { useEffect, useState } from 'react';
import { apiUrl } from '../config/backendConfig';

export type AgentDevice = { id: string; lastSeenAt: string; online: boolean };
export type AgentStatus = { devices: AgentDevice[]; anyOnline: boolean; queued: number };

/**
 * How often the screen re-asks.
 *
 * The server calls a device online while its last poll is under 90s old
 * (`agentStatus` in server/agentBridge.js) and the agent reopens its long-poll
 * every ~25s, so 30s here is roughly one question per report. Tighter would
 * only add requests without learning anything new.
 */
const POLL_MS = 30_000;

/**
 * Live state of the local agent — the "hands" behind open_app, open_url,
 * media_control and run_on_machine.
 *
 * This exists because that failure is silent everywhere else. When the agent
 * cannot reach the Hub it retries forever into its own log file, the tools just
 * time out after 30s, and the Jarvis answers as if it were *unable* rather than
 * *disconnected* — the two are indistinguishable from the chat. That gap went
 * unnoticed for 13 days (a missing HUB_URL, 15.957 failed attempts) and read,
 * from the outside, as an assistant that could not do things.
 *
 * `null` means "not asked yet". `unreachable` means the Hub itself did not
 * answer, which is a different problem from the Hub answering "no agent here" —
 * so the screen can say which one it is instead of blaming the agent for the
 * server being down.
 */
export function useAgentStatus(): { status: AgentStatus | null; unreachable: boolean } {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check(): Promise<void> {
      try {
        const res = await fetch(apiUrl('/api/agent/status'));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as AgentStatus;
        if (cancelled) return;
        setStatus(data);
        setUnreachable(false);
      } catch {
        if (cancelled) return;
        setUnreachable(true);
      }
    }

    void check();
    const timer = setInterval(() => void check(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return { status, unreachable };
}
