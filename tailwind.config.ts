import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Single accent colour, used everywhere. Calm teal-green.
        accent: {
          DEFAULT: "#0f766e",
          dark: "#115e59",
          light: "#ccfbf1",
        },
      },
    },
  },
  plugins: [],
};

export default config;
