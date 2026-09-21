import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        g: "#2563eb",
        b: "#16a34a",
      },
    },
  },
  plugins: [],
};
export default config;
