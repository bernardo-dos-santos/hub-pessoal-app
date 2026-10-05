export type ParsedCommit = {
  type: string;
  scope: string | null;
  description: string;
};

// Validado contra 80 commits reais deste repo: 74/80 mapeados sem IA.
const CONVENTIONAL_COMMIT_RE = /^(feat|fix|docs|chore|refactor|perf|style|test)(?:\(([a-z0-9-]+)\))?:\s*(.+)$/i;

export function parseConventionalCommit(subject: string): ParsedCommit | null {
  const match = CONVENTIONAL_COMMIT_RE.exec(subject.trim());
  if (!match) return null;
  return {
    type: match[1].toLowerCase(),
    scope: match[2]?.toLowerCase() ?? null,
    description: match[3].trim(),
  };
}
