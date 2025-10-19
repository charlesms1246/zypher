import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#00FFB3",
        secondary: "#FF6B00",
        violet: "#8A2EFF",
        abyss: "#0A2540",
        surface: "#121212",
        'text-secondary': "#B8B8B8",
        error: "#FF3B3B",
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        numeric: ['var(--font-numeric)', 'monospace'],
      },
      borderRadius: {
        'sm': '0.5rem',
        'md': '1rem',
        'lg': '1.5rem',
      },
      boxShadow: {
        'glow-primary': '0 0 20px rgba(0, 255, 179, 0.3)',
        'glow-violet': '0 0 20px rgba(138, 46, 255, 0.3)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
      },
    },
  },
  plugins: [],
};

export default config;
