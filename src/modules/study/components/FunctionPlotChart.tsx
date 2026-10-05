import { useEffect, useRef } from 'react';
import functionPlot from 'function-plot';

interface PlotSpec {
  fns: string[];
  domain: [number, number];
  label: string;
}

// Curvas plotadas — é data-viz, a única exceção do guia para cor fora de token.
// Mantidas fixas porque a biblioteca precisa de valor concreto, não de var().
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// Grid, eixos e rótulos NÃO são data-viz: são a moldura do gráfico, e a exceção
// do guia cobre só o preenchimento da série. Estes valores eram a paleta ardósia
// do tema escuro anterior (#334155/#475569/#94a3b8/#64748b), quase invisível
// sobre o fundo #F7F1E6 de hoje. Agora saem dos tokens.
const CHART_CSS = `
  .grid line { stroke: var(--hub-border-strong); stroke-opacity: 0.8; }
  .grid path { stroke-width: 0; }
  .x.axis line, .y.axis line { stroke: var(--hub-border-strong); }
  .x.axis path, .y.axis path { stroke: var(--hub-border-strong); }
  .x.axis text, .y.axis text { fill: var(--hub-muted); font-size: 11px; }
  .origin { stroke: var(--hub-subtle); }
`;

function parsePlotSpec(spec: string): PlotSpec {
  const lines = spec.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  const fns: string[] = [];
  let domain: [number, number] = [-5, 5];
  let label = '';

  for (const line of lines) {
    if (line.startsWith('domain:')) {
      const match = line.match(/\[(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\]/);
      if (match) domain = [parseFloat(match[1]), parseFloat(match[2])];
    } else if (line.startsWith('label:')) {
      label = line.replace('label:', '').trim();
    } else if (line.includes('=')) {
      const expr = line.split('=').slice(1).join('=').trim();
      if (expr) fns.push(expr);
    }
  }

  return { fns, domain, label };
}

interface FunctionPlotChartProps {
  spec: string;
}

export function FunctionPlotChart({ spec }: FunctionPlotChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { fns, domain, label } = parsePlotSpec(spec);

  useEffect(() => {
    if (!containerRef.current || fns.length === 0) return;

    const el = containerRef.current;
    el.innerHTML = '';

    try {
      functionPlot({
        target: el,
        width: el.clientWidth || 320,
        height: 220,
        grid: true,
        xAxis: { domain },
        data: fns.map((fn, i) => ({
          fn,
          graphType: 'polyline' as const,
          color: COLORS[i % COLORS.length],
        })),
        tip: { xLine: false, yLine: false }, // remove crosshair interativo
      });

      // Injeta CSS no SVG para estilizar o grid e desabilitar interação
      const svg = el.querySelector('svg');
      if (svg) {
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = CHART_CSS;
        svg.prepend(style);
      }
    } catch {
      el.innerHTML = `<p class="text-xs p-3" style="color:var(--hub-negative)">Erro ao renderizar gráfico: ${fns.join(', ')}</p>`;
    }

    return () => {
      el.innerHTML = '';
    };
  }, [spec]); // eslint-disable-line react-hooks/exhaustive-deps

  if (fns.length === 0) {
    return (
      <div className="my-3 p-3" style={{ border: '1px solid var(--hub-border)' }}>
        <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>Gráfico inválido — nenhuma função encontrada.</p>
      </div>
    );
  }

  return (
    <div className="my-3 overflow-hidden" style={{ border: '1px solid var(--hub-border)' }}>
      {label && (
        <div className="px-3 py-1.5" style={{ borderBottom: '1px solid var(--hub-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--hub-muted)' }}>{label}</p>
        </div>
      )}
      {/* pointer-events: none torna o gráfico estático (sem zoom/pan) */}
      <div ref={containerRef} className="w-full" style={{ pointerEvents: 'none' }} />
    </div>
  );
}
