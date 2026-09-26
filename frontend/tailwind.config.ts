import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#000000",
        foreground: "#FFFFFF",
        primary: {
          DEFAULT: "#000000",
          foreground: "#FFFFFF",
        },
        burgundy: {
          DEFAULT: "#6D001A",
          50: "#FFEDF0",
          100: "#FCD3D9",
          200: "#F59CA9",
          300: "#ED6277",
          400: "#D62545",
          500: "#A80026",
          600: "#6D001A", // Exact brand burgundy accent
          700: "#550014",
          800: "#3D000F",
          900: "#260009",
          950: "#130005",
        },
        accent: {
          DEFAULT: "#6D001A",
          hover: "#8B0022",
          active: "#550014",
          foreground: "#FFFFFF",
        },
        surface: {
          DEFAULT: "#0D0D0D",
          muted: "#171717",
          border: "#262626",
          hover: "#1F1F1F",
        },
        heatmap: {
          cold: "#1A0006",
          mid: "#6D001A",
          warm: "#B81D3D",
          hot: "#FF4D6D",
          peak: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["var(--font-montserrat)", "sans-serif"],
      },
      boxShadow: {
        burgundy: "0 0 25px -5px rgba(109, 0, 26, 0.4)",
        "burgundy-glow": "0 0 40px 0px rgba(109, 0, 26, 0.6)",
      },
      borderColor: {
        subtle: "rgba(255, 255, 255, 0.1)",
        burgundy: "#6D001A",
      },
    },
  },
  plugins: [],
};

export default config;
