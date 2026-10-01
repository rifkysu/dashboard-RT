/** Tailwind dibundel saat build (bukan lewat CDN), supaya tampilan tidak bergantung
 *  pada layanan luar saat production. Token warna & font sama dengan src/app-theme.css. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Public Sans"', 'Arial', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '"Public Sans"', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      colors: {
        dinas: { DEFAULT: '#1e3a5f', dark: '#142a47', ink: '#0e1e33', soft: '#e8eef6' },
        kuningan: { DEFAULT: '#b8893b', soft: '#f7efe0', ink: '#7a5a20' },
        primary: '#0f172a',
        'primary-focus': '#1e293b',
        accent: '#2563eb',
        'surface-subtle': '#f8fafc',
        'border-light': '#e2e8f0',
      },
    },
  },
  plugins: [],
};
