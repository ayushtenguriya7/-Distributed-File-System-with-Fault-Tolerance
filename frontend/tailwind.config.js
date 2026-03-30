/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        panel: "rgba(15, 23, 42, 0.65)",
      },
      boxShadow: {
        glow: "0 20px 45px rgba(59, 130, 246, 0.18)",
      },
      backgroundImage: {
        "dashboard-grid":
          "radial-gradient(circle at top, rgba(96, 165, 250, 0.18), transparent 35%), radial-gradient(circle at 20% 20%, rgba(168, 85, 247, 0.18), transparent 25%)",
      },
    },
  },
  plugins: [],
};
