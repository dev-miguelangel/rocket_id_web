/** Ilustraciones de paisajes para las historias (SVG propio, sin imágenes de terceros). */

type Scene = 'glaciar' | 'escalada' | 'rio' | 'cumbre'

const SKY: Record<Scene, [string, string]> = {
  glaciar: ['#bae6fd', '#e0f2fe'],
  escalada: ['#fed7aa', '#fef3c7'],
  rio: ['#a7f3d0', '#ecfdf5'],
  cumbre: ['#c7d2fe', '#fae8ff'],
}

export function SceneIllustration({ scene, title }: { scene: Scene; title: string }) {
  const [top, bottom] = SKY[scene]
  const id = `sky-${scene}`
  return (
    <svg viewBox="0 0 400 220" className="h-auto w-full" role="img" aria-label={title}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect width="400" height="220" fill={`url(#${id})`} />
      <circle cx={scene === 'escalada' ? 320 : 330} cy="50" r="22" fill="#fde68a" opacity="0.95" />

      {scene === 'glaciar' && (
        <>
          <path d="M0 160 L70 90 L120 130 L190 50 L250 120 L310 70 L400 150 L400 220 L0 220 Z" fill="#64748b" />
          <path d="M190 50 L215 78 L200 82 L185 72 L170 80 Z M310 70 L330 92 L312 96 L298 88 Z" fill="#f8fafc" />
          <path d="M150 220 C170 180 210 165 260 160 C300 156 330 170 360 220 Z" fill="#e0f2fe" />
          <path d="M0 220 L0 175 C60 165 110 180 160 200 L200 220 Z" fill="#0f766e" />
          <path d="M60 190 l6 -14 6 14 Z M90 196 l6 -14 6 14 Z" fill="#115e59" />
          <Hiker x={235} y={168} />
          <Hiker x={258} y={172} color="#f97316" />
        </>
      )}

      {scene === 'escalada' && (
        <>
          <path d="M120 220 L150 40 L210 30 L260 80 L250 220 Z" fill="#b45309" />
          <path d="M150 40 L210 30 L200 70 L160 90 Z" fill="#92400e" />
          <path d="M0 220 L0 180 C80 170 140 190 200 220 Z M260 220 C300 190 350 180 400 185 L400 220 Z" fill="#65a30d" />
          <path d="M205 34 C200 80 230 120 215 170" stroke="#f97316" strokeWidth="2" fill="none" strokeDasharray="4 3" />
          <Hiker x={212} y={110} color="#0f766e" />
          <Hiker x={226} y={196} />
        </>
      )}

      {scene === 'rio' && (
        <>
          <path d="M0 140 L80 80 L140 120 L220 60 L300 110 L400 70 L400 220 L0 220 Z" fill="#15803d" opacity="0.85" />
          <path d="M0 170 C80 150 140 190 220 170 C300 150 340 180 400 165 L400 220 L0 220 Z" fill="#0ea5e9" />
          <path d="M20 190 c20 -6 40 6 60 0 M150 200 c20 -6 40 6 60 0 M280 190 c20 -6 40 6 60 0" stroke="#e0f2fe" strokeWidth="3" fill="none" strokeLinecap="round" />
          <Kayak x={110} y={180} color="#f97316" />
          <Kayak x={200} y={188} color="#facc15" />
          <Kayak x={290} y={178} color="#ef4444" />
        </>
      )}

      {scene === 'cumbre' && (
        <>
          <path d="M0 200 L90 120 L150 160 L240 40 L330 150 L400 110 L400 220 L0 220 Z" fill="#475569" />
          <path d="M240 40 L265 72 L248 76 L232 66 L218 74 Z" fill="#f8fafc" />
          <path d="M0 220 L0 195 C90 180 160 200 230 220 Z" fill="#0f766e" />
          <line x1="240" y1="40" x2="240" y2="14" stroke="#1e293b" strokeWidth="2" />
          <path d="M240 14 L262 20 L240 26 Z" fill="#ef4444" />
          <Hiker x={228} y={52} color="#f97316" />
          <Hiker x={252} y={56} />
        </>
      )}
    </svg>
  )
}

function Hiker({ x, y, color = '#0f766e' }: { x: number; y: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cx="0" cy="-14" r="3.5" fill="#1e293b" />
      <path d="M-3 -10 L3 -10 L4 2 L-4 2 Z" fill={color} />
      <rect x="-7" y="-10" width="4" height="8" rx="1.5" fill="#1e293b" opacity="0.8" />
      <path d="M-3 2 L-5 10 M3 2 L5 10" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 -6 L9 10" stroke="#1e293b" strokeWidth="1.3" />
    </g>
  )
}

function Kayak({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-22 0 C-10 6 10 6 22 0 C10 -4 -10 -4 -22 0 Z" fill={color} />
      <circle cx="0" cy="-8" r="3.5" fill="#1e293b" />
      <path d="M-3 -5 L3 -5 L3 0 L-3 0 Z" fill="#1e293b" />
      <line x1="-14" y1="-12" x2="14" y2="2" stroke="#1e293b" strokeWidth="1.6" />
    </g>
  )
}
