declare module 'function-plot' {
  interface FunctionPlotDatum {
    fn: string;
    graphType?: 'polyline' | 'scatter' | 'interval';
    color?: string;
  }

  interface FunctionPlotOptions {
    target: HTMLElement | null;
    width?: number;
    height?: number;
    grid?: boolean;
    xAxis?: { domain?: [number, number]; label?: string };
    yAxis?: { domain?: [number, number]; label?: string };
    data: FunctionPlotDatum[];
    tip?: { xLine?: boolean; yLine?: boolean };
    background?: string;
  }

  function functionPlot(options: FunctionPlotOptions): { destroy?: () => void };

  export = functionPlot;
}
