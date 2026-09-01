import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // One accent — a deep, calm teal that stays legible on a dim
        // monitor and in daylight on a phone.
        accent: {
          DEFAULT: "#0f766e",
          dark: "#115e59",
          deep: "#0b423e",
          light: "#ccfbf1",
          wash: "#f0fbf8",
        },
        // Warm neutrals: paper, ink, hairline. Chosen warm so the
        // white bills sit on something softer than grey.
        paper: "#f6f5f2",
        ink: "#1c1a17",
        line: "#e4e0d8",
      },
      boxShadow: {
        lift: "0 1px 2px rgba(28,25,23,.05), 0 12px 28px -20px rgba(28,25,23,.45)",
      },
    },
  },
  plugins: [],
};

export default config;
