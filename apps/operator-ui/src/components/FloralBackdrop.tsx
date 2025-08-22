
type Props = {
  className?: string;
  navy?: boolean;
  density?: 'low' | 'med' | 'high';
  borderless?: boolean;
  opacity?: number;
  randomize?: boolean;
};

export default function FloralBackdrop({ className = '', navy = false, density = 'med', borderless = false, opacity = 1, randomize = true }: Props) {
  const bg = navy
    ? 'linear-gradient(180deg, #0b1020 0%, #0f162a 60%)'
    : 'linear-gradient(180deg, #ffffff 0%, #f7f3f7 100%)';

  // Slight random offsets for a more organic feel (client-side only)
  const r = (min: number, max: number) => (randomize ? (Math.random() * (max - min) + min) : (min + (max - min) / 2));
  const petals = (
    <>
      {/* Left bloom */}
      <g opacity={0.7} transform={`translate(${180 + r(-20,20)},${120 + r(-10,10)})`}>
        <ellipse rx="160" ry="110" fill="url(#petalSoft)" />
        <ellipse rx="120" ry="80" transform="rotate(25)" fill="url(#petalSoft)" />
        <ellipse rx="110" ry="70" transform="rotate(-18)" fill="url(#petalSoft)" />
        {/* gold nucleus */}
        <circle r="14" fill="url(#gold)" />
        {/* orbiting highlight */}
        <g>
          <circle cx="24" cy="0" r="4" fill="#fff6d6" opacity="0.95" />
          <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="18s" repeatCount="indefinite" />
        </g>
      </g>
      {/* Right bloom */}
      <g opacity={0.75} transform={`translate(${980 + r(-25,25)},${160 + r(-12,12)})`}>
        <ellipse rx="150" ry="105" fill="url(#petalSoft)" />
        <ellipse rx="120" ry="90" transform="rotate(-22)" fill="url(#petalSoft)" />
        <ellipse rx="90" ry="60" transform="rotate(14)" fill="url(#petalSoft)" />
        <circle r="14" fill="url(#gold)" />
        <g>
          <circle cx="22" cy="0" r="3.5" fill="#fff6d6" opacity="0.95" />
          <animateTransform attributeName="transform" type="rotate" from="360 0 0" to="0 0 0" dur="22s" repeatCount="indefinite" />
        </g>
      </g>
      {/* Mid flecks */}
      <g opacity="0.5">
        <g>
          <circle cx="600" cy="190" r="2" fill="#7FB5FF" />
          <circle cx="640" cy="210" r="1.5" fill="#7FB5FF" />
          <circle cx="560" cy="220" r="1.5" fill="#7FB5FF" />
          <circle cx="710" cy="170" r="2" fill="#7FB5FF" />
          <animateTransform attributeName="transform" type="rotate" from="0 600 190" to="360 600 190" dur="26s" repeatCount="indefinite" />
        </g>
      </g>
    </>
  );

  return (
    <div className={`relative ${borderless ? 'overflow-visible' : 'overflow-hidden rounded-3xl border shadow-sm'} ${className}`} style={{ background: bg, opacity }}>
      <svg className="absolute inset-0 w-[140%] left-1/2 -translate-x-1/2 h-full" viewBox="0 0 1200 320" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="petalSoft" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={navy ? 0.75 : 0.9} />
            <stop offset="100%" stopColor={navy ? '#1a2442' : '#F7DCEB'} stopOpacity={navy ? 0.25 : 0.25} />
          </radialGradient>
          <linearGradient id="gold" x1="0" x2="1">
            <stop offset="0%" stopColor="#E6C87A" />
            <stop offset="100%" stopColor="#F3E5AB" />
          </linearGradient>
          <filter id="soften"><feGaussianBlur stdDeviation="1.8"/></filter>
        </defs>
        <g filter="url(#soften)">
          {petals}
          {density !== 'low' && (
            <g opacity="0.5" transform="translate(0,40)">{petals}</g>
          )}
          {density === 'high' && (
            <g opacity="0.35" transform="translate(0,-40)">{petals}</g>
          )}
        </g>
        {/* Gentle base stroke */}
        <path d="M40,260 C260,240 420,280 640,260 C840,242 1000,278 1160,258" fill="none" stroke={navy ? 'rgba(191,215,255,0.25)' : 'rgba(243,179,207,0.35)'} strokeWidth="2" />
      </svg>
    </div>
  );
}


