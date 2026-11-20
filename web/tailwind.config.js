/** @type {import('tailwindcss').Config} */

// NSYU brand palette — white, deep forest green and emerald (matches the mobile app's
// AppColors: #047857 primary, #064E3B deep). `blue` is intentionally overridden with the
// same scale so every existing `blue-*` utility renders in the brand colour consistently.
const brand = {
  50: "#ECFDF5",
  100: "#D1FAE5",
  200: "#A7F3D0",
  300: "#6EE7B7",
  400: "#34D399",
  500: "#10B981",
  600: "#00845F",
  700: "#006B4D",
  800: "#005B43",
  900: "#005B43",
  950: "#03352A",
};

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: brand[600], ...brand },
        // Deep forest tones used for the sidebar, hero cards and strong headings
        navy: {
          DEFAULT: "#102A43",
          950: "#071A2A",
          900: "#102A43",
          800: "#173B55",
          700: "#1F4D67",
          600: "#2B6176",
        },
        blue: brand,
        ink: {
          DEFAULT: "#172B3A",
          900: "#172B3A",
          800: "#263D4B",
          700: "#3A5060",
          600: "#526777",
          500: "#64748B",
        },
        canvas: "#FAF9F5",
        ivory: "#FBFBF9",
        surface: "#FFFFFF",
        border: "#EAE7DD",
        muted: "#64748B",
        accent: { DEFAULT: brand[600], ...brand },
        warn: "#F59E0B",
        danger: "#EF4444",
      },
      fontFamily: {
        display: ["'DM Serif Display'", "'Plus Jakarta Sans'", "'Inter'", "-apple-system", "sans-serif"],
        serif: ["'DM Serif Display'", "Georgia", "serif"],
        sans: ["'Plus Jakarta Sans'", "'Inter'", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "sans-serif"],
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
