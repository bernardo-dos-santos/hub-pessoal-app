import { useState } from 'react';
import { rpgSessionLogService, type RpgSessionEntry } from '../../services/rpgSessionLogService';
import { type RpgCharacter, type RpgResourceId } from '../../types/rpg';

type Props = {
  character: RpgCharacter;
  onResourceChange: (resourceId: RpgResourceId, current: number) => void;
};

const kindColor: Record<RpgSessionEntry['kind'], string> = {
  dice: 'var(--hub-mauve)',
  rest: 'var(--hub-accent)',
  action: 'var(--hub-warning)',
  note: 'var(--hub-text-body)',
};

const kindIcon: Record<RpgSessionEntry['kind'], string> = {
  dice: '🎲',
  rest: '💤',
  action: '⚡',
  note: '📝',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RpgSessionLog({ character, onResourceChange }: Props) {
  const [log, setLog] = useState<RpgSessionEntry[]>(() => rpgSessionLogService.getLog());
  const [noteText, setNoteText] = useState('');

  function refresh() {
    setLog(rpgSessionLogService.getLog());
  }

  function handleShortRest() {
    // Descanso curto: restaura 1 recurso de Fadiga (se existir) e registra
    const fadiga = character.resources.find((r) => r.id === 'fadiga');
    if (fadiga && fadiga.current < fadiga.max) {
      const restored = Math.min(fadiga.current + Math.ceil(fadiga.max / 2), fadiga.max);
      onResourceChange('fadiga', restored);
      rpgSessionLogService.addEntry(`💤 Descanso Curto — Fadiga restaurada: ${fadiga.current} → ${restored}/${fadiga.max}`, 'rest');
    } else {
      rpgSessionLogService.addEntry('💤 Descanso Curto realizado', 'rest');
    }
    refresh();
  }

  function handleLongRest() {
    // Descanso longo: restaura todos os recursos ao máximo
    const restored: string[] = [];
    for (const resource of character.resources) {
      if (resource.current < resource.max) {
        onResourceChange(resource.id, resource.max);
        restored.push(`${resource.label}: ${resource.max}/${resource.max}`);
      }
    }
    const detail = restored.length > 0 ? ` (${restored.join(', ')})` : ' (tudo já estava no máximo)';
    rpgSessionLogService.addEntry(`💤 Descanso Longo — recursos restaurados${detail}`, 'rest');
    refresh();
  }

  function handleAddNote() {
    const text = noteText.trim();
    if (!text) return;
    rpgSessionLogService.addEntry(text, 'note');
    setNoteText('');
    refresh();
  }

  function handleClear() {
    rpgSessionLogService.clearLog();
    refresh();
  }

  return (
    <div className="space-y-5">
      {/* Botões de descanso */}
      <div>
        <p className="mb-2 font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--hub-label)' }}>Descanso</p>
        <div className="flex gap-6">
          <button
            onClick={handleShortRest}
            className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            💤 Descanso Curto
          </button>
          <button
            onClick={handleLongRest}
            className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            🌙 Descanso Longo
          </button>
        </div>
      </div>

      {/* Adicionar nota */}
      <div>
        <p className="mb-1.5 font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--hub-label)' }}>Adicionar nota ao log</p>
        <div className="flex items-baseline gap-3">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
            placeholder="ex: Ativei Golpe Certeiro, gastei 2 PV"
            className="min-w-0 flex-1 text-sm"
          />
          <button
            onClick={handleAddNote}
            disabled={!noteText.trim()}
            className="shrink-0 text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            +
          </button>
        </div>
      </div>

      {/* Log */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--hub-label)' }}>Log da sessão</p>
          {log.length > 0 && (
            <button
              onClick={handleClear}
              className="text-[10px] transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Limpar log
            </button>
          )}
        </div>

        {log.length === 0 ? (
          <p className="py-3 text-center text-xs" style={{ color: 'var(--hub-subtle)' }}>
            Nenhum evento registrado nesta sessão.
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            {log.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2 py-2"
                style={{ borderBottom: '1px solid var(--hub-border)' }}
              >
                <span className="mt-0.5 shrink-0 text-sm">{kindIcon[entry.kind]}</span>
                <p className="flex-1 text-xs leading-relaxed" style={{ color: kindColor[entry.kind] }}>
                  {entry.text}
                </p>
                <span className="shrink-0 text-[10px] tabular-nums" style={{ color: 'var(--hub-subtle)' }}>{formatTime(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
