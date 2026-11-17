/** @type {import('tailwindcss').Config} */

// NSYU brand palette — white, deep forest green and emerald (matches the mobile app's
// AppColors: #047857 primary, #064E3B deep). `blue` is intentionally overridden with the
// same scale so every existing `blue-*` utility renders in the brand colour consistently.
const brand = {
  50: "#EEFBF4",
  100: "#D5F5E3",
  200: "#ABE9C8",
  300: "#74D6A6",
  400: "#3DBC82",
  500: "#16A06A",
  600: "#047857",
  700: "#06684B",
  800: "#08553F",
  900: "#064E3B",
  950: "#032B21",
};

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: brand[600], ...brand },
        // Deep forest tones used for the sidebar, hero cards and strong headings
        navy: {
          DEFAULT: "#063A2C",
          950: "#021A13",
          900: "#04261D",
          800: "#063A2C",
          700: "#0A4A39",
          600: "#0F5C47",
        },
        blue: brand,
        ink: {
          DEFAULT: "#0F172A",
          900: "#0F172A",
          800: "#1E293B",
          700: "#334155",
          600: "#475569",
          500: "#64748B",
        },
        canvas: "#F6F8FA",
        surface: "#FFFFFF",
        border: "#E4E9EE",
        muted: "#64748B",
        accent: { DEFAULT: brand[600], ...brand },
        warn: "#F59E0B",
        danger: "#EF4444",
      },
      fontFamily: {
        display: ["'Inter'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        sans: ["'Inter'", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(4, 38, 29, 0.05)",
        soft: "0 1px 2px 0 rgba(4, 38, 29, 0.04), 0 1px 3px 0 rgba(4, 38, 29, 0.05)",
        card: "0 1px 2px 0 rgba(4, 38, 29, 0.04), 0 6px 16px -6px rgba(4, 38, 29, 0.08)",
        lift: "0 10px 30px -12px rgba(4, 38, 29, 0.25)",
        brand: "0 6px 16px -6px rgba(4, 120, 87, 0.40)",
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};
