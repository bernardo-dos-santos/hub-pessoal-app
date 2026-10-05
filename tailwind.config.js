/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Sinais semânticos do design system Terracota */
        fi: {
          mint:   'var(--hub-positive)',
          coral:  'var(--hub-negative)',
          indigo: 'var(--hub-accent)',
        },
        hub: {
          bg: 'var(--hub-bg)',
          shell: 'var(--hub-shell)',
          card: 'var(--hub-card)',
          header: 'var(--hub-header)',
          surface: 'var(--hub-surface)',
          'surface-muted': 'var(--hub-surface-muted)',
          'surface-soft': 'var(--hub-surface-soft)',
          border: 'var(--hub-border)',
          'border-strong': 'var(--hub-border-strong)',
          text: 'var(--hub-text)',
          'text-strong': 'var(--hub-text-strong)',
          'text-body': 'var(--hub-text-body)',
          muted: 'var(--hub-muted)',
          subtle: 'var(--hub-subtle)',
          label: 'var(--hub-label)',
          disabled: 'var(--hub-disabled)',
          primary: 'var(--hub-primary)',
          'primary-strong': 'var(--hub-primary-strong)',
          accent: 'var(--hub-accent)',
          positive: 'var(--hub-positive)',
          negative: 'var(--hub-negative)',
          warning: 'var(--hub-warning)',
          mauve: 'var(--hub-mauve)',
          progress: 'var(--hub-progress)',
          neutral: 'var(--hub-neutral)',
        },
      },
      boxShadow: {
        soft: 'var(--hub-shadow-card)',
        'hub-chip': 'var(--hub-shadow-chip)',
        'hub-card': 'var(--hub-shadow-card)',
        'hub-hero': 'var(--hub-shadow-hero)',
        'hub-menu': 'var(--hub-shadow-menu)',
        'hub-modal': 'var(--hub-shadow-modal)',
      },
      borderRadius: {
        card: 'var(--hub-radius-card)',
      },
    },
  },
  plugins: [],
};
