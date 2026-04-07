/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                primary: "#6366f1", // Indigo 500
                secondary: "#a855f7", // Purple 500
            },
        },
    },
    plugins: [],
}
