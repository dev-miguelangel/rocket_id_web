import type { ReactNode } from 'react'
import { Logo } from '../../components/Logo'
import { VerifiedBadge } from '../../components/VerifiedBadge'

/**
 * Pantallas de la app dibujadas con HTML/CSS (sin capturas reales ni datos de personas).
 * Usan los mismos tokens de color, así respetan el modo claro y oscuro.
 */

export function PhoneFrame({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="img" aria-label={label} className={`relative mx-auto w-[248px] shrink-0 ${className}`}>
      <div className="rounded-[2.6rem] bg-zinc-900 p-2.5 shadow-2xl shadow-primary/20 ring-1 ring-white/10 dark:bg-zinc-800">
        <div className="relative h-[500px] overflow-hidden rounded-[2.1rem] bg-surface" aria-hidden="true">
          <div className="absolute top-2 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-zinc-900 dark:bg-zinc-800" />
          <div className="h-full overflow-hidden pt-9 text-fg">{children}</div>
        </div>
      </div>
    </div>
  )
}

const Bar = ({ title }: { title: string }) => (
  <div className="flex items-center justify-between px-4 pb-2">
    <span className="text-[13px] font-bold">{title}</span>
    <span className="flex items-center gap-1.5">
      <span className="relative text-sm">
        🔔
        <span className="absolute -top-1 -right-1.5 flex size-3.5 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold text-white">2</span>
      </span>
      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">MA</span>
    </span>
  </div>
)

const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-line bg-card p-2.5 ${className}`}>{children}</div>
)

const Label = ({ children }: { children: ReactNode }) => <p className="text-[8px] text-muted">{children}</p>
const Value = ({ children }: { children: ReactNode }) => <p className="text-[10px] font-semibold">{children}</p>

const TabBar = ({ active }: { active: number }) => (
  <div className="absolute inset-x-0 bottom-0 flex h-12 items-center justify-around border-t border-line bg-card px-2 text-[8px] text-muted">
    {['Inicio', 'Datos', 'Cursos', 'Cordada', 'Eventos'].map((t, i) => (
      <span key={t} className={`flex flex-col items-center gap-0.5 ${i === active ? 'font-semibold text-primary-text' : ''}`}>
        <span className={`h-1.5 w-6 rounded-full ${i === active ? 'bg-primary/40' : 'bg-line'}`} />
        {t}
      </span>
    ))}
  </div>
)

/** Inicio: saludo, preparación y recomendación */
export function ScreenHome() {
  return (
    <div className="relative h-full">
      <Bar title="Inicio" />
      <div className="space-y-2.5 px-3">
        <div className="rounded-2xl bg-gradient-to-br from-primary-dark to-primary p-3 text-white">
          <p className="text-[9px] font-medium">Bienvenida de vuelta</p>
          <p className="text-sm font-bold">Hola, Martina 👋</p>
          <p className="mt-2 inline-block rounded-full bg-white/15 px-2 py-0.5 font-mono text-[9px] font-bold whitespace-nowrap">🚀 MA-8426</p>
        </div>
        <p className="text-[10px] font-bold">Tu preparación</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            ['🩺', '100%', 'Ficha completa'],
            ['🎓', '3', 'Vigentes · 2 ✓'],
            ['🏔️', '2', 'Próximas salidas'],
            ['🪢', '6', '4 con prim. aux.'],
          ].map(([i, v, l]) => (
            <Card key={l} className="p-2">
              <p className="flex justify-between text-[10px]">
                <span>{i}</span>
                <span className="font-extrabold">{v}</span>
              </p>
              <p className="mt-1 text-[8px] text-muted">{l}</p>
            </Card>
          ))}
        </div>
        <p className="text-[10px] font-bold">Cursos recomendados</p>
        <Card>
          <p className="text-[10px] font-semibold">🩹 Primeros Auxilios en Áreas Remotas</p>
          <p className="mt-1.5 rounded-md bg-primary/5 px-2 py-1 text-[8px] font-medium text-primary-text">✨ Tu “WFA” vence en mar 2027</p>
        </Card>
      </div>
      <TabBar active={0} />
    </div>
  )
}

/** Ficha de emergencia vista por el organizador */
export function ScreenFicha() {
  return (
    <div className="relative h-full">
      <div className="flex items-center justify-between border-b border-line px-4 pb-2 text-[10px]">
        <span className="text-primary-text">Cerrar</span>
        <span className="font-bold">Ficha de emergencia</span>
        <span className="w-8" />
      </div>
      <div className="space-y-2 px-3 pt-3">
        <p className="text-[8px] font-semibold tracking-wide text-muted uppercase">🆘 Contacto de emergencia</p>
        <Card className="space-y-1.5">
          <div>
            <Label>Contacto</Label>
            <Value>Paula Rivas (hermana)</Value>
          </div>
          <div>
            <Label>Teléfono</Label>
            <Value>+56 9 4321 8765</Value>
          </div>
        </Card>
        <div className="flex h-8 items-center justify-center rounded-lg bg-red-600 text-[10px] font-semibold text-white">📞 Llamar al contacto de emergencia</div>
        <p className="pt-1 text-[8px] font-semibold tracking-wide text-muted uppercase">⛑️ Salud</p>
        <Card className="space-y-1.5">
          <div className="grid grid-cols-2">
            <div>
              <Label>Grupo sanguíneo</Label>
              <Value>O+</Value>
            </div>
            <div>
              <Label>Previsión</Label>
              <Value>Fonasa</Value>
            </div>
          </div>
          <div>
            <Label>Alergias</Label>
            <Value>Picaduras de abeja (severa)</Value>
          </div>
          <div>
            <Label>Medicamentos</Label>
            <Value>EpiPen · bolsillo superior de la mochila</Value>
          </div>
        </Card>
        <p className="text-center text-[8px] text-muted">✓ Visualización registrada y notificada</p>
      </div>
    </div>
  )
}

/** Detalle de evento con la revisión previa */
export function ScreenEvent() {
  return (
    <div className="relative h-full">
      <Bar title="Evento" />
      <div className="space-y-2.5 px-3">
        <div className="rounded-2xl bg-gradient-to-br from-primary-dark to-primary p-3 text-white">
          <p className="flex justify-between text-[9px] font-medium">
            <span>🛶 Kayak / agua</span>
            <span className="rounded-full bg-white/20 px-1.5">🌎 Público</span>
          </p>
          <p className="mt-1 text-sm leading-tight font-bold">Bajada del Trancura</p>
          <p className="mt-1 text-[9px]">📅 dom 24 ene · 09:00–16:00</p>
          <p className="text-[9px]">📍 Pucón, La Araucanía</p>
        </div>
        <p className="text-[8px] font-semibold tracking-wide text-muted uppercase">Revisión antes de la salida</p>
        <Card className="space-y-1.5 text-[9px]">
          <p>✅ 7 personas confirmadas</p>
          <p>✅ Todas las invitaciones respondidas</p>
          <p className="font-semibold">⚠️ Ficha incompleta: Diego, Sofía</p>
          <p className="font-semibold">⚠️ Requisito pendiente — Joaquín: Rescate</p>
        </Card>
        <p className="text-[10px] font-bold">Participantes · 7/8</p>
        {['Valentina (organiza)', 'Diego', 'Sofía'].map((n, i) => (
          <div key={n} className="flex items-center gap-2">
            <span className={`flex size-6 items-center justify-center rounded-full text-[8px] font-bold text-white ${['bg-primary', 'bg-sky-600', 'bg-violet-600'][i]}`}>
              {n[0]}
            </span>
            <span className="flex-1 text-[10px] font-semibold">{n}</span>
            {i > 0 && <span className="text-[9px]">⚠️</span>}
            <span className="rounded-full bg-emerald-100 px-1.5 text-[8px] font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">Confirmado</span>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-12 border-t border-line bg-surface px-3 py-2">
        <div className="flex h-8 items-center justify-center rounded-lg bg-primary text-[10px] font-semibold text-white">🪢 Invitar a mi cordada</div>
      </div>
      <TabBar active={4} />
    </div>
  )
}

/** Perfil público de deportista */
export function ScreenProfile() {
  return (
    <div className="relative h-full">
      <div className="relative h-24 bg-gradient-to-br from-primary-dark to-primary">
        <div className="flex items-center gap-1.5 px-3 pt-1 text-[10px] font-bold text-white">
          <Logo className="size-4 rounded" /> rocketId
        </div>
        <svg viewBox="0 0 400 60" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-10 w-full">
          <path d="M0 60 L0 40 L80 15 L130 35 L200 5 L260 38 L330 18 L400 40 L400 60 Z" fill="white" opacity="0.15" />
          <path d="M0 60 L0 50 L90 35 L160 48 L240 30 L320 50 L400 44 L400 60 Z" fill="var(--surface)" />
        </svg>
      </div>
      <div className="-mt-8 flex flex-col items-center px-3 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-primary text-lg font-bold text-white ring-4 ring-surface">MA</span>
        <p className="mt-1.5 flex items-center gap-1 text-sm font-extrabold">
          Martina Aravena <VerifiedBadge className="size-4" />
        </p>
        <p className="mt-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-bold whitespace-nowrap text-primary-text">🚀 MA-8426</p>
        <div className="mt-3 grid w-full grid-cols-3 divide-x divide-line rounded-xl border border-line bg-card py-1.5">
          {[
            ['3', 'Vigentes'],
            ['2', 'Verificadas'],
            ['3', 'Áreas'],
          ].map(([v, l]) => (
            <span key={l}>
              <span className="block text-sm font-extrabold">{v}</span>
              <span className="text-[8px] text-muted">{l}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 space-y-1.5 px-3">
        {[
          ['🩹', 'WFR (Wilderness First Responder)', 'Vigente', true],
          ['🥾', 'Guía de montaña', 'Vigente', true],
          ['🧗', 'Rescate en avalanchas Nivel 1', 'Vigente', false],
        ].map(([i, n, s, v]) => (
          <Card key={String(n)} className="flex items-center gap-2 p-2">
            <span className="text-sm">{i}</span>
            <span className="flex-1 text-[9px] leading-tight font-semibold">
              {n} {v ? '✓' : ''}
            </span>
            <span className="rounded-full bg-emerald-100 px-1.5 text-[8px] font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">{s}</span>
          </Card>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 border-t border-line bg-surface px-3 py-2.5">
        <div className="flex h-8 items-center justify-center rounded-lg bg-primary text-[10px] font-semibold text-white">Abrir en rocketId</div>
      </div>
    </div>
  )
}

/** Cordada: búsqueda y lista */
export function ScreenCordada() {
  return (
    <div className="relative h-full">
      <Bar title="Cordada" />
      <div className="px-3">
        <div className="flex h-8 items-center gap-2 rounded-lg border border-field bg-card px-2.5 text-[10px] text-muted">🔍 fer</div>
        <div className="mt-3 space-y-2.5">
          {[
            ['Fernanda Contreras', 'YU-9460', 'bg-violet-600', 'En tu cordada'],
            ['Fernando Ibáñez', 'KO-2210', 'bg-sky-600', ''],
            ['Fernanda Rojas', 'BE-7741', 'bg-amber-600', ''],
          ].map(([n, r, c, note]) => (
            <div key={r} className="flex items-center gap-2.5">
              <span className={`flex size-9 items-center justify-center rounded-full text-[10px] font-bold text-white ${c}`}>
                {n
                  .split(' ')
                  .map((w) => w[0])
                  .join('')}
              </span>
              <span>
                <span className="block text-[11px] font-semibold">{n}</span>
                <span className="font-mono text-[9px] whitespace-nowrap text-muted">
                  {r}
                  {note && <span className="font-sans"> · {note}</span>}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <TabBar active={3} />
    </div>
  )
}

/** Conocimientos con insignia de verificado */
export function ScreenSkills() {
  return (
    <div className="relative h-full">
      <Bar title="Mis datos" />
      <div className="space-y-2 px-3">
        <p className="flex justify-between text-[8px] font-semibold tracking-wide text-muted uppercase">
          🎓 Conocimientos y experiencia <span className="text-primary-text normal-case">Editar</span>
        </p>
        <Card className="space-y-2.5">
          {[
            ['🩹', 'WFA (Wilderness First Aid)', 'Escuela Andina de Montaña · 2025 · vence mar 2027', 'Vigente', true],
            ['🧗', 'Iniciación a la escalada', 'Club Alpino Cordillera · 2024', 'Vigente', false],
            ['🧭', 'Navegación con GPS', 'Escuela de Montaña · 2026', 'En curso', false],
          ].map(([i, n, m, s, v]) => (
            <div key={String(n)} className="flex gap-2">
              <span className="text-sm">{i}</span>
              <span className="flex-1">
                <span className="flex items-center gap-1 text-[10px] font-semibold">
                  {n} {v && <VerifiedBadge className="size-3" />}
                </span>
                <span className="block text-[8px] text-muted">{m}</span>
                {v && <span className="block text-[8px] font-medium text-blue-600 dark:text-blue-400">Verificado por la institución</span>}
              </span>
              <span
                className={`h-fit rounded-full px-1.5 text-[8px] font-semibold ${s === 'Vigente' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300'}`}
              >
                {s}
              </span>
            </div>
          ))}
        </Card>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-2 text-[9px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          ⏳ <strong>“WFA”</strong> vence pronto · Vence en mar 2027
        </div>
      </div>
      <TabBar active={1} />
    </div>
  )
}

export const SCREENS = {
  ficha: ScreenFicha,
  formacion: ScreenSkills,
  cordada: ScreenCordada,
  eventos: ScreenEvent,
  cursos: ScreenHome,
} as const
