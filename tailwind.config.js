/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F4F7F6",
        paper2: "#FFFFFF",
        well: "#EEF4F2",
        ink: "#17211F",
        muted: "#61706C",
        faint: "#899590",
        line: "#DCE6E2",
        teal: "#2F7D69",
        tealDark: "#235F50",
        gold: "#E7B94B",
        emerald: "#2F7D69",
        amber: "#B97823",
        rust: "#B85C5C"
      },
      fontFamily: {
        serif: ['"Nunito Sans"', "Inter", "system-ui", "sans-serif"],
        sans: ['"Nunito Sans"', "Inter", "system-ui", "sans-serif"],
        mono: ['"Nunito Sans"', "Inter", "system-ui", "sans-serif"]
      },
      boxShadow: {
        paper: "0 1px 2px rgba(27, 52, 45, .04), 0 12px 32px rgba(27, 52, 45, .07)",
        lift: "0 8px 24px rgba(27, 52, 45, .14)",
        float: "0 18px 48px rgba(27, 52, 45, .12)"
      }
    },
  },
  plugins: [],
};
