/** @type {import('tailwindcss').Config} */

// NSYU design system — white canvas, deep forest ink and emerald accents
// (matches the mobile app's AppColors: #047857 primary, #064E3B deep).
// `blue` is intentionally overridden with the brand scale so every legacy
// `blue-*` utility renders in the brand colour consistently.
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
  900: "#064E3B",
  950: "#03352A",
};

// Deep forest ink — headings, dark surfaces (sidebar, portal header, footers).
const navy = {
  DEFAULT: "#0E2A23",
  950: "#04211A",
  900: "#0E2A23",
  800: "#163A31",
  700: "#1F4A3F",
  600: "#2C5D50",
};

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: brand[600], ...brand },
        navy,
        blue: brand,
        ink: {
          DEFAULT: "#1E293B",
          900: "#0F172A",
          800: "#1E293B",
          700: "#334155",
          600: "#475569",
          500: "#64748B",
        },
        canvas: "#F6F8F7",
        ivory: "#FFFFFF",
        surface: "#FFFFFF",
        border: "#E4E9E7",
        muted: "#64748B",
        accent: { DEFAULT: brand[600], ...brand },
        warn: "#F59E0B",
        danger: "#EF4444",
      },
      fontFamily: {
        display: ["'Plus Jakarta Sans'", "'Inter'", "-apple-system", "sans-serif"],
        serif: ["'DM Serif Display'", "Georgia", "serif"],
        sans: ["'Plus Jakarta Sans'", "'Inter'", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        "2xs": "0 1px 1px 0 rgba(15, 42, 35, 0.04)",
        xs: "0 1px 2px 0 rgba(15, 42, 35, 0.05)",
        soft: "0 1px 2px 0 rgba(15, 42, 35, 0.04), 0 2px 6px -1px rgba(15, 42, 35, 0.05)",
        card: "0 1px 2px 0 rgba(15, 42, 35, 0.04), 0 8px 24px -12px rgba(15, 42, 35, 0.10)",
        lift: "0 2px 4px -1px rgba(15, 42, 35, 0.05), 0 18px 40px -16px rgba(15, 42, 35, 0.22)",
        pop: "0 24px 60px -20px rgba(4, 33, 26, 0.35)",
        brand: "0 1px 2px 0 rgba(0, 107, 77, 0.25), 0 8px 18px -8px rgba(0, 132, 95, 0.55)",
        "inner-top": "inset 0 1px 0 0 rgba(255, 255, 255, 0.12)",
      },
      borderRadius: {
        card: "16px",
        "4xl": "28px",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #04211A 0%, #064E3B 55%, #00845F 100%)",
        "brand-sheen": "radial-gradient(120% 140% at 100% 0%, rgba(52, 211, 153, 0.35) 0%, rgba(52, 211, 153, 0) 55%)",
        "canvas-glow": "radial-gradient(900px 420px at 100% -10%, rgba(167, 243, 208, 0.25), transparent 60%)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "none" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) backwards",
        "scale-in": "scale-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) backwards",
        shimmer: "shimmer 1.6s infinite",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
