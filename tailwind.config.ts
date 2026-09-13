import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Railway theme colors
        railway: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          200: '#c3d4ff',
          300: '#9ab3ff',
          400: '#6b88ff',
          500: '#1a56db',  // Indian Railways blue
          600: '#1740a8',
          700: '#132d7a',
          800: '#0e1f52',
          900: '#08122e',
        },
        gold: {
          400: '#f6c90e',
          500: '#d4a800',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
