/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0F172A",
          900: "#0F172A",
          800: "#1E293B",
          700: "#334155",
          600: "#475569",
          500: "#64748B",
        },
        canvas: "#F4F7FB",
        surface: "#FFFFFF",
        border: "#E2E8F0",
        muted: "#64748B",
        accent: {
          DEFAULT: "#2563EB",
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
        },
        warn: "#F59E0B",
        danger: "#EF4444",
      },
      fontFamily: {
        display: ["'Inter'", "'Space Grotesk'", "sans-serif"],
        sans: ["'Inter'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["'IBM Plex Mono'", "'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 4px 12px -2px rgba(0, 0, 0, 0.05)",
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};
