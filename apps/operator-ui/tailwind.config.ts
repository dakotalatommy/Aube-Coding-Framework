export default {
	content: [
		"./index.html",
		"./src/**/*.{ts,tsx}",
	],
	theme: {
		extend: {
			colors: {
				brand: {
					50:'#FFEFF5',100:'#FFD8E7',200:'#FFC0D8',300:'#FFA6C8',400:'#FF8CB7',
					500:'#F574A7',600:'#D25D8F',700:'#AB4874',800:'#83375A',900:'#5D2741',
				},
				powder: {
					50:'#F2FAFF',100:'#E6F5FF',200:'#CCE9FF',300:'#B3DEFF',400:'#99D2FF',
					500:'#80C6FF',600:'#5AAAE6',700:'#3E88BF',800:'#2A648F',900:'#1A425F',
				},
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
				ink: { 900:'#0b1220', 700:'#334155', 500:'#64748b' },
			},
			borderRadius: {
				lg: "12px",
				md: "10px",
				sm: "8px",
				xl: 'var(--radius)',
				"2xl": 'calc(var(--radius) + 4px)',
			},
			boxShadow: {
				sm: "0 1px 2px rgba(15, 23, 42, 0.06)",
				md: "0 6px 16px rgba(15, 23, 42, 0.08)",
				soft: 'var(--shadow-soft)'
			},
		},
	},
	plugins: [],
}
