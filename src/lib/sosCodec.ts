/**
 * Datos de emergencia dentro de un enlace: https://rocketid.vercel.app/sos#z.<datos>
 * Lo que va después de "#" NUNCA se envía al servidor: la página /sos lo decodifica en el teléfono
 * de quien escanea. Se comprime (deflate) para que el QR sea menos denso y fácil de leer.
 */

export interface SosData {
  /** nombre */ n?: string
  /** nacimiento YYYY-MM-DD */ b?: string
  /** documento */ d?: string
  /** grupo sanguíneo */ s?: string
  /** alergias */ a?: string
  /** condiciones */ c?: string
  /** medicamentos */ m?: string
  /** previsión */ i?: string
  /** contacto de emergencia: nombre, parentesco, teléfono */ e?: { n?: string; r?: string; p?: string }
}

const toB64url = (bytes: Uint8Array) => {
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromB64url = (s: string): Uint8Array<ArrayBuffer> => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(b64)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Blob([bytes]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

const clean = (d: SosData): SosData => {
  const out: SosData = {}
  for (const [k, v] of Object.entries(d)) {
    if (k === 'e' && v && typeof v === 'object') {
      const e = Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'string' && x.trim()))
      if (Object.keys(e).length) out.e = e
    } else if (typeof v === 'string' && v.trim()) (out as Record<string, string>)[k] = v.trim()
  }
  return out
}

/** Devuelve el fragmento (sin "#"): "z.<deflate>" si el navegador comprime, o "j.<json>" */
export async function encodeSos(data: SosData): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(clean(data)))
  if (typeof CompressionStream !== 'undefined') {
    try {
      return `z.${toB64url(await pipe(json, new CompressionStream('deflate-raw')))}`
    } catch {
      /* sin compresión */
    }
  }
  return `j.${toB64url(json)}`
}

export async function decodeSos(fragment: string): Promise<SosData | null> {
  try {
    const raw = fragment.replace(/^#/, '')
    const [kind, payload] = [raw.slice(0, 2), raw.slice(2)]
    let bytes = fromB64url(payload)
    if (kind === 'z.') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'))
    else if (kind !== 'j.') return null
    const v = JSON.parse(new TextDecoder().decode(bytes))
    return v && typeof v === 'object' ? clean(v as SosData) : null
  } catch {
    return null
  }
}

export const sosUrl = (origin: string, fragment: string) => `${origin}/sos#${fragment}`
