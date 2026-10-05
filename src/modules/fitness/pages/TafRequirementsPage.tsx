import { TafStatusCard } from '../components/TafStatusCard';
import { tafService } from '../services/tafService';

export function TafRequirementsPage() {
  const results = tafService.getAllTestResults();

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--hub-muted)' }}>
        Requisitos mínimos do TAF — Corpo de Bombeiros SC.{' '}
        <span style={{ color: 'var(--hub-subtle)' }}>Atualize conforme o edital quando publicado.</span>
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {results.map((result) => (
          <TafStatusCard key={result.requirement.id} result={result} />
        ))}
      </div>
    </div>
  );
}
