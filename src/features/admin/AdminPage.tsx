import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { HoldButton } from '../../components/HoldButton'
import { Switch } from '../../components/form'
import { Logo } from '../../components/Logo'
import { useAuth } from '../auth/AuthProvider'
import { DAILY_RANGE, isAdminEmail, loadMetrics, type Metrics } from './adminApi'
import { mockStatus, purgeMockUsers, seedMockUsers, setDemoCourses, type MockStatus } from './mockData'

const fmt = (n: number | null | undefined) => (typeof n === 'number' ? n.toLocaleString('es-CL') : '—')
const pct = (a: number | null, b: number | null) => (a !== null && b ? `${Math.round((a / b) * 100)}%` : '—')

/**
 * Panel de administración (independiente, como la landing). Solo lo ve la cuenta de administración:
 * la pantalla lo comprueba y, sobre todo, las reglas de Firestore solo le permiten a esa cuenta los conteos.
 */
export function AdminPage() {
  const { user } = useAuth()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [m, setM] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    document.title = 'rocketId · Admin'
    return () => {
      document.title = 'rocketId'
    }
  }, [])

  useEffect(() => {
    let alive = true
    isAdminEmail(user?.emailVerified ? user.email : null).then((ok) => alive && setAllowed(ok))
    return () => {
      alive = false
    }
  }, [user])

  // Botón "Actualizar"
  const refresh = useCallback(() => {
    setLoading(true)
    loadMetrics()
      .then(setM)
      .finally(() => setLoading(false))
  }, [])

  // Primera carga al confirmar el acceso (el estado se actualiza solo cuando llegan los datos)
  useEffect(() => {
    if (!allowed) return
    let alive = true
    loadMetrics().then((r) => alive && setM(r))
    return () => {
      alive = false
    }
  }, [allowed])

  if (allowed === false) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-6 text-center text-fg">
        <Logo className="size-14" />
        <h1 className="text-2xl font-bold">Esta vista es solo para administración</h1>
        <p className="max-w-sm text-base text-muted">Tu cuenta no tiene acceso a las métricas de rocketId.</p>
        <Link to="/" className="flex h-12 items-center rounded-xl bg-primary px-6 text-base font-semibold text-white active:bg-primary-dark">
          Volver a rocketId
        </Link>
      </div>
    )
  }

  const realUsers = m?.users !== null && m?.users !== undefined ? m.users - (m.mockUsers ?? 0) : null

  return (
    <div className="min-h-dvh bg-surface text-fg">
      <header className="pt-safe sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold">
            <Logo className="size-8 rounded-lg" /> rocketId
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold text-primary-text">Admin</span>
          </Link>
          <button
            type="button"
            onClick={refresh}
            disabled={loading || !allowed}
            className="flex h-11 items-center gap-2 rounded-xl border border-line px-4 text-base font-medium active:bg-line/60 disabled:opacity-60"
          >
            <span aria-hidden="true" className={loading ? 'animate-spin motion-reduce:animate-none' : ''}>
              ↻
            </span>
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </header>

      <main className="pb-safe mx-auto max-w-6xl space-y-8 px-4 py-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Métricas</h1>
          <p className="mt-1 text-base text-muted" aria-live="polite">
            {m ? `Actualizado ${m.at.toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Cargando métricas…'}
          </p>
        </div>

        {/* Lo principal: inscritos, visitas y conversión */}
        <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Hero label="Usuarios inscritos" value={fmt(realUsers)} hint={m?.mockUsers ? `sin contar ${fmt(m.mockUsers)} de prueba` : 'cuentas reales'} loading={!m} />
          <Hero label="Visitas a la landing" value={fmt(m?.visits)} hint="una por sesión del navegador" loading={!m} />
          <Hero label="Conversión" value={pct(realUsers, m?.visits ?? null)} hint="inscritos / visitas" loading={!m} />
          <Hero label="Activos (7 días)" value={fmt(m?.active7)} hint={`${pct(m?.active7 ?? null, m?.users ?? null)} del total`} loading={!m} />
        </section>

        <section aria-labelledby="visits-title" className="rounded-2xl border border-line bg-card p-4 sm:p-6">
          <h2 id="visits-title" className="text-lg font-bold">
            Visitas por día
          </h2>
          <p className="text-sm text-muted">Últimos {DAILY_RANGE} días · hora de Chile</p>
          {m ? m.daily ? <DailyBars data={m.daily} /> : <p className="mt-4 text-base text-muted">No se pudieron cargar las visitas por día.</p> : <div className="mt-4 h-48 animate-pulse rounded-xl bg-line/60" />}
        </section>

        <Group title="Usuarios">
          <Stat label="Nuevos (7 días)" value={fmt(m?.new7)} loading={!m} />
          <Stat label="Nuevos (30 días)" value={fmt(m?.new30)} loading={!m} />
          <Stat label="Completaron el recorrido" value={fmt(m?.onboarded)} hint={pct(m?.onboarded ?? null, m?.users ?? null)} loading={!m} />
          <Stat label="Cuentas de prueba" value={fmt(m?.mockUsers)} hint="se purgan antes del lanzamiento" loading={!m} />
        </Group>

        <Group title="Actividad">
          <Stat label="Eventos creados" value={fmt(m?.events)} hint={m ? `${fmt(m.publicEvents)} públicos` : undefined} loading={!m} />
          <Stat label="Eventos próximos" value={fmt(m?.upcomingEvents)} loading={!m} />
          <Stat label="Participaciones" value={fmt(m?.participants)} hint="incluye organizadores" loading={!m} />
          <Stat label="Vínculos de cordada" value={fmt(m?.cordada)} loading={!m} />
          <Stat label="Postulaciones a cursos" value={fmt(m?.applications)} loading={!m} />
        </Group>

        {allowed && <TestData onChanged={refresh} />}

        <p className="text-sm text-subtle">
          Los conteos se calculan en el servidor y no muestran datos personales. Las cifras de usuarios nuevos y activos pueden incluir cuentas de prueba.
        </p>
      </main>
    </div>
  )
}

function Hero({ label, value, hint, loading }: { label: string; value: string; hint?: string; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 sm:p-5">
      <p className="text-sm font-medium text-muted">{label}</p>
      {loading ? (
        <span className="mt-2 block h-9 w-20 animate-pulse rounded-lg bg-line/60" />
      ) : (
        <p className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl">{value}</p>
      )}
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
    </section>
  )
}

function Stat({ label, value, hint, loading }: { label: string; value: string; hint?: string; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="text-sm text-muted">{label}</p>
      {loading ? <span className="mt-2 block h-7 w-14 animate-pulse rounded-lg bg-line/60" /> : <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>}
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
    </div>
  )
}

const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions) => new Date(`${day}T12:00:00`).toLocaleDateString('es-CL', opts)

/** Barras de visitas por día: una sola serie (sin leyenda), tooltip al pasar o enfocar, tabla para lectores de pantalla */
function DailyBars({ data }: { data: { day: string; visits: number }[] }) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.visits))
  const total = data.reduce((a, d) => a + d.visits, 0)
  const shown = active !== null ? data[active] : null

  return (
    <div className="mt-4">
      <p className="h-6 text-sm text-fg" aria-hidden="true">
        {shown ? (
          <>
            <span className="font-semibold tabular-nums">{fmt(shown.visits)}</span> {shown.visits === 1 ? 'visita' : 'visitas'} ·{' '}
            {dayLabel(shown.day, { weekday: 'long', day: 'numeric', month: 'long' })}
          </>
        ) : (
          <>
            <span className="font-semibold tabular-nums">{fmt(total)}</span> visitas en el período
          </>
        )}
      </p>
      <div className="relative mt-2 h-48" aria-hidden="true">
        {/* Línea de referencia del máximo, recesiva */}
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
        <span className="absolute top-0 right-0 -translate-y-full pb-0.5 text-xs text-muted tabular-nums">{fmt(max)}</span>
        <div className="absolute inset-0 flex items-end gap-[2px] border-b border-line">
          {data.map((d, i) => (
            <button
              key={d.day}
              type="button"
              tabIndex={-1}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onClick={() => setActive(i)}
              className="flex h-full flex-1 items-end"
            >
              <span
                className={`block w-full rounded-t-[4px] transition-colors ${active === i ? 'bg-primary-dark' : 'bg-primary'}`}
                style={{ height: `${d.visits ? Math.max(2, (d.visits / max) * 100) : 0}%` }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted" aria-hidden="true">
        <span>{dayLabel(data[0].day, { day: 'numeric', month: 'short' })}</span>
        <span>{dayLabel(data[data.length - 1].day, { day: 'numeric', month: 'short' })}</span>
      </div>
      <table className="sr-only">
        <caption>Visitas a la landing por día</caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            <th scope="col">Visitas</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{dayLabel(d.day, { weekday: 'long', day: 'numeric', month: 'long' })}</td>
              <td>{d.visits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------- Datos de prueba ----------

/** Crear / purgar usuarios de prueba y mostrar / ocultar los cursos de demostración */
function TestData({ onChanged }: { onChanged: () => void }) {
  const [st, setSt] = useState<MockStatus | null>(null)
  const [busy, setBusy] = useState<'seed' | 'purge' | 'courses' | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    let alive = true
    mockStatus()
      .then((r) => alive && setSt(r))
      .catch(() => alive && setMsg({ ok: false, text: 'No se pudo leer el estado de los datos de prueba.' }))
    return () => {
      alive = false
    }
  }, [])

  const run = async (kind: 'seed' | 'purge' | 'courses', fn: () => Promise<string>) => {
    setBusy(kind)
    setMsg(null)
    try {
      const text = await fn()
      setMsg({ ok: true, text })
      setSt(await mockStatus())
      onChanged()
    } catch (e) {
      console.error('test data', e)
      setMsg({ ok: false, text: 'No se pudo completar. Revisa tu conexión e inténtalo de nuevo; lo ya hecho se conserva.' })
    } finally {
      setBusy(null)
      setConfirming(false)
    }
  }

  const seed = () => run('seed', async () => {
    const n = await seedMockUsers()
    return n ? `Se crearon ${n} usuarios de prueba.` : 'Los usuarios de prueba ya estaban creados.'
  })
  const purge = () => run('purge', async () => `Se eliminaron ${await purgeMockUsers()} documentos de prueba.`)
  const toggleCourses = () =>
    st &&
    run('courses', async () => {
      await setDemoCourses(!st.demoCourses)
      return st.demoCourses ? 'Cursos de demostración ocultos para todas las personas.' : 'Cursos de demostración visibles otra vez.'
    })

  const all = st && st.users >= st.total
  return (
    <section aria-labelledby="test-title" className="rounded-2xl border border-line bg-card p-4 sm:p-6">
      <h2 id="test-title" className="text-lg font-bold">
        Datos de prueba
      </h2>
      <p className="mt-1 text-sm text-muted">Personas y cursos ficticios para mostrar la app. Purga todo antes del lanzamiento.</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Usuarios */}
        <div className="space-y-3 rounded-xl bg-surface p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-base font-semibold">Usuarios de prueba</h3>
            <span className="text-sm text-muted tabular-nums">{st ? `${st.users} de ${st.total}` : '…'}</span>
          </div>
          <p className="text-sm text-muted">Cuentas con correo @rocketid.test, buscables en Cordada. Al purgar también se quitan de las cordadas de personas reales.</p>
          {!all && (
            <button
              type="button"
              onClick={seed}
              disabled={!st || !!busy}
              className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-white active:bg-primary-dark disabled:opacity-60"
            >
              {busy === 'seed' ? 'Creando…' : st?.users ? `Crear los ${st.total - st.users} que faltan` : 'Crear usuarios de prueba'}
            </button>
          )}
          {st && st.users > 0 &&
            (confirming ? (
              <div className="space-y-2" role="group" aria-label="Confirmar purga">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  Se eliminarán {st.users} usuarios de prueba y sus referencias. No se puede deshacer, pero puedes volver a crearlos.
                </p>
                <HoldButton onConfirm={purge} disabled={!!busy}>
                  {busy === 'purge' ? 'Purgando…' : 'Mantén presionado para purgar'}
                </HoldButton>
                <button type="button" onClick={() => setConfirming(false)} className="h-11 w-full rounded-xl text-base font-medium text-muted active:bg-line/60">
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={!!busy}
                className="h-12 w-full rounded-xl border border-red-300 text-base font-semibold text-red-700 active:bg-red-50 disabled:opacity-60 dark:border-red-500/40 dark:text-red-300 dark:active:bg-red-500/10"
              >
                Purgar usuarios de prueba
              </button>
            ))}
        </div>

        {/* Cursos */}
        <div className="space-y-3 rounded-xl bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 id="demo-courses" className="text-base font-semibold">
              Cursos de demostración
            </h3>
            <Switch checked={!!st?.demoCourses} onChange={toggleCourses} labelledBy="demo-courses" disabled={!st || !!busy} />
          </div>
          <p className="text-sm text-muted">
            {st ? (st.demoCourses ? 'Visibles en Cursos y en las recomendaciones del Inicio.' : 'Ocultos: Cursos muestra "Pronto habrá cursos disponibles".') : '…'} Las
            postulaciones que ya existen no se borran.
          </p>
        </div>
      </div>

      {msg && (
        <p role="status" className={`mt-4 rounded-xl p-3 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200'}`}>
          {msg.ok ? '✓ ' : '⚠️ '}
          {msg.text}
        </p>
      )}
    </section>
  )
}
