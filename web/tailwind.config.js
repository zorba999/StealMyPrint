/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0E0E0E",
        coal: "#171717",
        paper: "#F4F1EA",
        bone: "#E8E3D7",
        signal: "#FF3B1F",
        verdict: "#12A150",
        amber: "#FFB020",
        electric: "#C9F24D",
        haze: "#8A8578",
      },
      fontFamily: {
        display: ['"Host Grotesk"', "Arial", "sans-serif"],
        serif: ['"Instrument Serif"', "Times New Roman", "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      letterSpacing: { tightest: "-0.05em", tighter: "-0.035em" },
    },
  },
  plugins: [],
};
