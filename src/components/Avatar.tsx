import { useState } from 'react'

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toLocaleUpperCase('es'))
    .join('') || '?'

export function Avatar({ name, photoURL, className = 'size-12' }: { name: string; photoURL: string | null; className?: string }) {
  const [broken, setBroken] = useState(false)
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-semibold text-white ${className}`}>
      {photoURL && !broken ? (
        <img src={photoURL} alt="" referrerPolicy="no-referrer" className="size-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  )
}
