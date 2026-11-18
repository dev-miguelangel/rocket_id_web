// Roseta de 12 puntas redondeadas (estilo insignia "verificado")
const POINTS = Array.from({ length: 24 }, (_, i) => {
  const r = i % 2 === 0 ? 11 : 9.3
  const a = (Math.PI * i) / 12 - Math.PI / 2
  return `${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`
}).join(' ')

/** Insignia de verificado, similar al check azul de cuentas verificadas. */
export function VerifiedBadge({ className = 'size-4', label = 'Verificado por la institución emisora' }: { className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`inline-block shrink-0 ${className}`} role="img" aria-label={label}>
      <title>{label}</title>
      <polygon points={POINTS} fill="#3B82F6" stroke="#3B82F6" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M7.6 12.3l3 3 5.8-6.2" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
