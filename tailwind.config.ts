import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['var(--font-jakarta)', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)',    'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
