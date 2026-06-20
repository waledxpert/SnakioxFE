export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        arcade: ['"Courier New"', "monospace"],
        display: ['"Trebuchet MS"', "Arial", "sans-serif"]
      },
      boxShadow: {
        phosphor: "0 0 24px rgba(178, 255, 102, 0.28)",
        insetPanel: "inset 0 0 0 2px rgba(24, 44, 26, 0.9)"
      }
    }
  },
  plugins: []
};
