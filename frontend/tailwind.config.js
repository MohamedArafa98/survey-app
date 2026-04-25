/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef5ff",
          100: "#d9e8ff",
          500: "#3366ff",
          600: "#254edb",
          700: "#1d3fb3",
        },
      },
    },
  },
  plugins: [],
};
