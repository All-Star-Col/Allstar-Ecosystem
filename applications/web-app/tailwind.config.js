/** @type {import('tailwindcss').Config} */
export default {
darkMode: "class",
content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
theme: {
		extend: {
		keyframes: {
			l7: {
			'to': { 'background-position': 'left' },
			},
		},
		animation: {
			'loader-steps': 'l7 2s infinite steps(11)',
		},
		colors: {
			primary: "#C7664C",
			"primary-hover": "#B0553E",
			"background-light": "#F0F2F5",
			"background-dark": "#0F172A",
			"card-light": "#F6F5F0",
			"card-dark": "#1E293B",
			"text-main": "#122337",
			"text-light": "#F8FAFC",
			"accent": "#B69599",
			"gold-border": "#C5A059",
		},
		fontFamily: {
			display: ["Inter", "sans-serif"],
			sans: ["Inter", "sans-serif"],
			mono: ["monospace"], // Útil para el loader
		},
		borderRadius: {
			xl: "1.25rem",
		},
		boxShadow: {
			premium: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
		},
		},
},
};