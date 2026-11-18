import { useEffect, useState, type ReactNode } from 'react'
import { Logo } from '../../components/Logo'
import { toE164Digits } from '../../lib/phone'
import { decodeSos, type SosData } from '../../lib/sosCodec'
import { EMERGENCY_NUMBERS } from '../events/EmergencySheet'

/**
 * Página de emergencia que abre el QR de la tarjeta: /sos#z.<datos>
 * Los datos vienen en el propio enlace (después de "#", que no se envía al servidor):
 * no hay sesión, ni consulta a la base de datos, ni registro.
 */
export function SosPage() {
  const [data, setData] = useState<SosData | null | undefined>(undefined)

  useEffect(() => {
    document.title = '🆘 Emergencia · rocketId'
    const read = () => decodeSos(window.location.hash).then(setData)
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  const age = data?.b ? ageFrom(data.b) : null
  const contactDigits = data?.e?.p ? toE164Digits(data.e.p) : ''

  return (
    <div className="min-h-dvh bg-surface pb-10 text-fg">
      <header className="pt-safe bg-red-700 text-white">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-4">
          <span className="text-3xl" aria-hidden="true">
            🆘
          </span>
          <div className="flex-1">
            <h1 className="text-2xl leading-none font-extrabold tracking-wide">EMERGENCIA</h1>
            <p className="mt-1 text-sm font-medium">Información médica de esta persona</p>
          </div>
          <Logo className="size-9 rounded-lg ring-2 ring-white/40" />
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
        {data === undefined ? (
          <div className="h-64 animate-pulse rounded-2xl bg-line" aria-label="Cargando" />
        ) : data === null || !Object.keys(data).length ? (
          <div className="rounded-2xl border border-line bg-card p-6 text-center">
            <p className="text-lg font-bold">No pudimos leer este código</p>
            <p className="mt-1 text-base text-muted">El enlace está incompleto o dañado. Si hay riesgo vital, llama al 131.</p>
          </div>
        ) : (
          <>
            {data.n && (
              <section className="rounded-2xl border border-line bg-card p-4">
                <p className="text-2xl leading-tight font-extrabold">{data.n}</p>
                {(data.b || data.d) && (
                  <p className="mt-1 text-base text-fg-soft">
                    {[data.b && `${new Date(`${data.b}T00:00:00`).toLocaleDateString('es')}${age !== null ? ` · ${age} años` : ''}`, data.d].filter(Boolean).join(' · ')}
                  </p>
                )}
              </section>
            )}

            {data.s && (
              <section className="flex items-center justify-between rounded-2xl border-2 border-red-600 bg-red-50 px-5 py-4 dark:bg-red-500/10">
                <span className="text-base font-semibold text-red-900 dark:text-red-200">🩸 Grupo sanguíneo</span>
                <span className="text-4xl font-extrabold text-red-700 dark:text-red-300">{data.s === 'unknown' ? '¿?' : data.s}</span>
              </section>
            )}

            {data.a && <Item tone="danger" icon="⚠️" label="Alergias" value={data.a} />}
            {data.m && <Item icon="💊" label="Medicamentos (y dónde los lleva)" value={data.m} />}
            {data.c && <Item icon="🩺" label="Condiciones médicas" value={data.c} />}
            {data.i && <Item icon="🏥" label="Previsión y seguros" value={data.i} />}

            {data.e && (data.e.n || data.e.p) && (
              <section className="rounded-2xl border border-line bg-card p-4">
                <p className="text-sm font-semibold tracking-wide text-muted uppercase">Contacto de emergencia</p>
                <p className="mt-1 text-xl font-bold">
                  {data.e.n} {data.e.r && <span className="text-base font-medium text-muted">({data.e.r})</span>}
                </p>
                {data.e.p && <p className="text-lg tabular-nums">{data.e.p}</p>}
                {contactDigits && (
                  <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <a href={`tel:+${contactDigits}`} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-3 font-semibold text-white active:bg-red-700">
                      📞 Llamar
                    </a>
                    <a
                      href={`https://wa.me/${contactDigits}?text=${encodeURIComponent(`Hola, te escribo porque eres el contacto de emergencia de ${data.n || 'una persona'} y necesita ayuda.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 font-semibold text-white active:opacity-80"
                    >
                      💬 WhatsApp
                    </a>
                  </div>
                )}
              </section>
            )}
          </>
        )}

        <section>
          <p className="mb-2 px-1 text-sm font-semibold tracking-wide text-muted uppercase">Números de emergencia · Chile</p>
          <ul className="grid grid-cols-3 gap-2">
            {EMERGENCY_NUMBERS.map((n) => (
              <li key={n.number}>
                <a href={`tel:${n.number}`} aria-label={`Llamar al ${n.number}, ${n.label}`} className={`flex min-h-20 flex-col items-center justify-center rounded-2xl text-white ${n.className}`}>
                  <span className="text-2xl" aria-hidden="true">
                    {n.icon}
                  </span>
                  <span className="text-xl font-extrabold">{n.number}</span>
                  <span className="text-xs font-medium">{n.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <p className="px-1 text-center text-xs text-muted">
          Información ingresada por la propia persona y no verificada médicamente. Estos datos vienen dentro del código: rocketId no los guarda ni los registra.
        </p>
      </main>
    </div>
  )
}

function Item({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: 'danger' }) {
  return (
    <section className={`rounded-2xl border p-4 ${tone === 'danger' ? 'border-amber-400 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10' : 'border-line bg-card'}`}>
      <p className={`text-sm font-semibold tracking-wide uppercase ${tone === 'danger' ? 'text-amber-900 dark:text-amber-200' : 'text-muted'}`}>
        <span aria-hidden="true">{icon} </span>
        {label}
      </p>
      <p className="mt-1 text-lg leading-snug font-medium break-words whitespace-pre-line">{value as ReactNode}</p>
    </section>
  )
}

function ageFrom(b: string) {
  const d = new Date(`${b}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--
  return a
}
