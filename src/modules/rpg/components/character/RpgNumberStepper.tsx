type RpgNumberStepperProps = {
  onChange: (nextValue: number) => void;
  value: number;
};

export function RpgNumberStepper({ onChange, value }: RpgNumberStepperProps) {
  return (
    <div className="grid grid-cols-[2.25rem_5rem_2.25rem] items-center gap-1">
      <button
        className="grid h-9 w-9 place-items-center text-lg transition-opacity hover:opacity-70"
        style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
        type="button"
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <input
        className="h-9 min-w-0 text-center text-sm font-medium tabular-nums"
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <button
        className="grid h-9 w-9 place-items-center text-lg transition-opacity hover:opacity-70"
        style={{ color: 'var(--hub-positive)', background: 'none', border: 'none', cursor: 'pointer' }}
        type="button"
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
