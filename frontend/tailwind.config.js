/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        noir: {
          black: '#0A0A0A',
          dark: '#1E1E1E',
          gray: '#2D2D2D',
          light: '#3F3F3F',
        },
        teal: {
          glow: '#00D4FF',
          dark: '#00A8CC',
        },
        success: '#00FF88',
        danger: '#FF0055',
        warning: '#FFB800',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'glitch': 'glitch 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
        'scan': 'scan 3s linear infinite',
      },
    },
  },
  plugins: [],
}
