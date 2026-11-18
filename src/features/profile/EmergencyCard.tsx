import QRCode from 'qrcode'
import { useEffect, useMemo, useState } from 'react'
import { toTitleCaseName } from '../../lib/names'
import { DOC_TYPES, INSURANCE_SYSTEMS, ageFrom, type ProfileForm } from './schema'

/**
 * Tarjeta de emergencia: un QR con los datos esenciales EN EL PROPIO CÓDIGO (texto), para que
 * cualquier cámara lo lea sin internet ni la app. Nada se sube a ningún servidor.
 */

type FieldKey = 'name' | 'age' | 'doc' | 'blood' | 'allergies' | 'conditions' | 'medications' | 'insurance' | 'contact'

const FIELDS: { key: FieldKey; label: string; default: boolean }[] = [
  { key: 'name', label: 'Nombre', default: true },
  { key: 'age', label: 'Fecha de nacimiento y edad', default: true },
  { key: 'blood', label: 'Grupo sanguíneo', default: true },
  { key: 'allergies', label: 'Alergias', default: true },
  { key: 'conditions', label: 'Condiciones médicas', default: true },
  { key: 'medications', label: 'Medicamentos y dónde los llevas', default: true },
  { key: 'contact', label: 'Contacto de emergencia', default: true },
  { key: 'insurance', label: 'Previsión y seguros', default: false },
  { key: 'doc', label: 'Documento de identidad', default: false },
]

const PREFS_KEY = 'rocketid-emergency-card-fields'
const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

function lines(p: ProfileForm, on: Set<FieldKey>) {
  const out: [string, string][] = []
  const age = ageFrom(p.birthDate)
  if (on.has('name') && p.fullName) out.push(['Nombre', toTitleCaseName(p.fullName)])
  if (on.has('age') && p.birthDate) out.push(['Nacimiento', `${new Date(`${p.birthDate}T00:00:00`).toLocaleDateString('es')}${age !== null ? ` (${age} años)` : ''}`])
  if (on.has('doc') && p.docNumber) out.push([DOC_TYPES.find((d) => d.value === p.docType)?.label ?? 'Documento', p.docNumber])
  if (on.has('blood') && p.bloodType) out.push(['Grupo sanguíneo', p.bloodType === 'unknown' ? 'No lo sé' : p.bloodType])
  if (on.has('allergies') && p.allergies) out.push(['Alergias', clip(p.allergies)])
  if (on.has('conditions') && p.conditions) out.push(['Condiciones', clip(p.conditions)])
  if (on.has('medications') && p.medications) out.push(['Medicamentos', clip(p.medications)])
  if (on.has('insurance') && (p.insuranceSystem || p.insuranceDetail))
    out.push(['Previsión', clip([INSURANCE_SYSTEMS.find((s) => s.value === p.insuranceSystem)?.label, p.insuranceDetail].filter(Boolean).join(' · '))])
  if (on.has('contact') && (p.emergencyName || p.emergencyPhone))
    out.push(['Contacto de emergencia', [toTitleCaseName(p.emergencyName), p.emergencyRelationship && `(${p.emergencyRelationship})`, p.emergencyPhone].filter(Boolean).join(' ')])
  return out
}

const qrText = (rows: [string, string][]) => ['🆘 EMERGENCIA · rocketId', ...rows.map(([k, v]) => `${k}: ${v}`), 'Ante riesgo vital llama al 131 (SAMU)'].join('\n')

function readPrefs(): Set<FieldKey> {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return new Set(JSON.parse(raw) as FieldKey[])
  } catch {
    /* sin preferencias guardadas */
  }
  return new Set(FIELDS.filter((f) => f.default).map((f) => f.key))
}

export function EmergencyCard({ profile }: { profile: ProfileForm }) {
  const [on, setOn] = useState<Set<FieldKey>>(readPrefs)
  const [svg, setSvg] = useState('')
  const [busy, setBusy] = useState<'wallpaper' | 'card' | null>(null)
  const rows = useMemo(() => lines(profile, on), [profile, on])
  const text = useMemo(() => qrText(rows), [rows])

  useEffect(() => {
    let alive = true
    QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#18181b', light: '#ffffff' } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(''))
    return () => {
      alive = false
    }
  }, [text])

  const toggle = (k: FieldKey) => {
    const next = new Set(on)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    setOn(next)
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify([...next]))
    } catch {
      /* ignorar */
    }
  }

  const download = async (kind: 'wallpaper' | 'card') => {
    setBusy(kind)
    try {
      const blob = await renderImage(kind, rows, text)
      const name = kind === 'wallpaper' ? 'rocketid-fondo-emergencia.png' : 'rocketid-tarjeta-emergencia.png'
      const file = new File([blob], name, { type: 'image/png' })
      // En el teléfono: menú de compartir (Guardar imagen / Imprimir). En computador: descarga.
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Tarjeta de emergencia' }).catch(() => {})
      else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = name
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
      }
    } finally {
      setBusy(null)
    }
  }

  const empty = rows.length === 0

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <p className="font-semibold text-fg">Para cuando nadie tenga señal ni la app</p>
        <p className="mt-1 max-w-prose text-base text-fg-soft">
          Tus datos van <strong>dentro del código QR</strong>: cualquier cámara los lee sin internet. Guárdalo como fondo de pantalla o imprímelo para tu mochila o casco.
        </p>
      </div>

      {/* Vista previa */}
      <div className="flex flex-col items-center rounded-2xl border-2 border-red-600 bg-white p-4 text-zinc-900">
        <p className="text-sm font-extrabold tracking-wider text-red-700">🆘 EMERGENCIA</p>
        {empty ? (
          <p className="py-12 text-center text-sm text-zinc-600">Elige al menos un dato o completa tu ficha en Mis datos.</p>
        ) : (
          <div className="mt-2 w-full max-w-[220px] [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label="Código QR con tus datos de emergencia" dangerouslySetInnerHTML={{ __html: svg }} />
        )}
        <p className="mt-2 text-center text-xs text-zinc-600">Escanea con la cámara · no necesita internet</p>
      </div>

      <section>
        <h4 className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-muted uppercase">Qué incluir</h4>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {FIELDS.map((f) => (
            <li key={f.key}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 active:bg-line/60">
                <input type="checkbox" checked={on.has(f.key)} onChange={() => toggle(f.key)} className="size-5 shrink-0 accent-[#0F766E]" />
                <span className="flex-1 text-base text-fg">{f.label}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-2 px-1 text-sm text-muted">⚠️ Quien escanee el código verá estos datos. Incluye solo lo necesario para atenderte.</p>
      </section>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => download('wallpaper')}
          disabled={empty || !!busy}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-white active:bg-primary-dark disabled:opacity-50"
        >
          📱 {busy === 'wallpaper' ? 'Generando…' : 'Fondo de pantalla'}
        </button>
        <button
          type="button"
          onClick={() => download('card')}
          disabled={empty || !!busy}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-field bg-card px-4 text-base font-semibold text-fg active:bg-line/60 disabled:opacity-50"
        >
          🖨️ {busy === 'card' ? 'Generando…' : 'Tarjeta para imprimir'}
        </button>
      </div>

      <details className="rounded-2xl border border-line bg-card">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 text-base font-medium text-fg [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true">💡</span>
          <span className="flex-1">Configura también la ID médica de tu teléfono</span>
          <span className="text-muted" aria-hidden="true">›</span>
        </summary>
        <div className="space-y-2 px-4 pb-4 text-base text-fg-soft">
          <p>Se ve desde la pantalla bloqueada, sin tu clave:</p>
          <p>
            <strong>iPhone:</strong> app Salud → tu foto → ID médica → Editar → activa “Mostrar con el iPhone bloqueado”.
          </p>
          <p>
            <strong>Android:</strong> Ajustes → Seguridad y emergencia → Información médica y Contactos de emergencia.
          </p>
        </div>
      </details>
    </div>
  )
}

// ---------- Imagen descargable (canvas) ----------

async function renderImage(kind: 'wallpaper' | 'card', rows: [string, string][], text: string): Promise<Blob> {
  const W = kind === 'wallpaper' ? 1170 : 1050
  const H = kind === 'wallpaper' ? 2532 : 600
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, text, { errorCorrectionLevel: 'M', margin: 1, width: kind === 'wallpaper' ? 620 : 470 })

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#dc2626'
  ctx.fillRect(0, 0, W, kind === 'wallpaper' ? 22 : 16)
  ctx.textBaseline = 'top'

  // Lo crítico también en texto, para verlo sin escanear
  const critical = rows.filter(([k]) => ['Nombre', 'Grupo sanguíneo', 'Alergias', 'Contacto de emergencia'].includes(k))

  if (kind === 'wallpaper') {
    // Arriba queda libre para el reloj del teléfono bloqueado
    let y = 980
    ctx.fillStyle = '#b91c1c'
    ctx.font = '800 64px system-ui, sans-serif'
    ctx.fillText('🆘 EMERGENCIA', 80, y)
    y += 100
    ctx.fillStyle = '#18181b'
    for (const [k, v] of critical) {
      ctx.font = '600 34px system-ui, sans-serif'
      ctx.fillStyle = '#52525b'
      ctx.fillText(k, 80, y)
      y += 44
      ctx.fillStyle = '#18181b'
      ctx.font = '700 42px system-ui, sans-serif'
      y = wrap(ctx, v, 80, y, W - 160, 52) + 18
    }
    ctx.drawImage(qr, (W - qr.width) / 2, H - qr.height - 260)
    ctx.fillStyle = '#52525b'
    ctx.font = '500 32px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Escanea con la cámara · no necesita internet', W / 2, H - 220)
    ctx.fillText('Riesgo vital: llama al 131 (SAMU)', W / 2, H - 170)
  } else {
    ctx.drawImage(qr, W - qr.width - 50, (H - qr.height) / 2)
    let y = 50
    ctx.fillStyle = '#b91c1c'
    ctx.font = '800 44px system-ui, sans-serif'
    ctx.fillText('🆘 EMERGENCIA', 50, y)
    y += 74
    for (const [k, v] of critical) {
      ctx.fillStyle = '#52525b'
      ctx.font = '600 22px system-ui, sans-serif'
      ctx.fillText(k, 50, y)
      y += 28
      ctx.fillStyle = '#18181b'
      ctx.font = '700 28px system-ui, sans-serif'
      y = wrap(ctx, v, 50, y, W - qr.width - 140, 34) + 12
      if (y > H - 80) break
    }
    ctx.fillStyle = '#52525b'
    ctx.font = '500 20px system-ui, sans-serif'
    ctx.fillText('Escanea el QR para ver todos los datos · rocketId', 50, H - 46)
  }
  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'))
}

/** Escribe texto con salto de línea automático; devuelve la nueva coordenada y */
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ')
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y)
      y += lh
      line = w
    } else line = test
  }
  if (line) ctx.fillText(line, x, y)
  return y + lh
}
