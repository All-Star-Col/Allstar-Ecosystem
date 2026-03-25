/** @type {import('tailwindcss').Config} */
export default {
	darkMode: "class",
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
		keyframes: {
			"l7": {
				"to": { "background-position": "left" },
			},
			"caret-blink": {
				"0%, 100%": { opacity: "1" },
				"50%": { opacity: "0" },
			},
			"accordion-down": {
				from: { height: "0" },
				to: { height: "var(--radix-accordion-content-height)" },
			},
			"accordion-up": {
				from: { height: "var(--radix-accordion-content-height)" },
				to: { height: "0" },
			},
		},
		animation: {
			"loader-steps": "l7 2s infinite steps(11)",
			"caret-blink": "caret-blink 1s step-end infinite",
			"accordion-down": "accordion-down 0.2s ease-out",
			"accordion-up": "accordion-up 0.2s ease-out",
		},
		fontFamily: {
			display: ["Inter", "sans-serif"],
			sans: ["Inter", "sans-serif"],
			mono: ["monospace"],
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