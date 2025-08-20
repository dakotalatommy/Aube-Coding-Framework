export default {
	content: [
		"./index.html",
		"./src/**/*.{ts,tsx}",
	],
	theme: {
		extend: {
			colors: {
				primary: {
					DEFAULT: "#0EA5E9",
					600: "#0284C7",
				},
				accent: "#22C55E",
				foreground: "#0F172A",
				muted: "#64748B",
				border: "#E5E7EB",
				background: "#FFFFFF",
				card: "#FFFFFF",
			},
			borderRadius: {
				lg: "12px",
				md: "10px",
				sm: "8px",
			},
			boxShadow: {
				sm: "0 1px 2px rgba(15, 23, 42, 0.06)",
				md: "0 6px 16px rgba(15, 23, 42, 0.08)",
			},
		},
	},
	plugins: [],
}
