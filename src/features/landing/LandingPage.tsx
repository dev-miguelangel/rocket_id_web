import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '../../components/Logo'
import { useAuth } from '../auth/AuthProvider'
import { FAQ, FEATURES, HERO, PAINS, PRIVACY, STEPS, STORIES, USE_CASES } from './content'
import { SceneIllustration } from './illustrations'
import { PhoneFrame, SCREENS, ScreenFicha, ScreenHome, ScreenProfile } from './mockups'
import { useInstallPrompt } from './useInstallPrompt'

/**
 * Landing de rocketId. Se muestra en "/" a quien no ha iniciado sesión, y siempre en "/conoce".
 * Mobile-first: secciones apiladas en celular, dos columnas desde md.
 */
export function LandingPage() {
  const { user } = useAuth()
  const ctaTo = user ? '/' : '/login'
  const ctaLabel = user ? 'Abrir mi rocketId' : HERO.primary

  useEffect(() => {
    document.title = 'rocketId · Tu identidad outdoor'
    return () => {
      document.title = 'rocketId'
    }
  }, [])

  return (
    <div className="min-h-dvh bg-surface text-fg">
      <Nav ctaTo={ctaTo} loggedIn={!!user} />

      <main>
        <Hero ctaTo={ctaTo} ctaLabel={ctaLabel} />
        <Pains />
        <HowItWorks />
        <Features />
        <UseCases />
        <Stories />
        <Privacy />
        <Faq />
        <FinalCta ctaTo={ctaTo} ctaLabel={ctaLabel} />
      </main>

      <footer className="pb-safe border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center text-sm text-muted sm:flex-row sm:justify-between sm:text-left">
          <span className="flex items-center gap-2 font-semibold text-fg">
            <Logo className="size-6 rounded-md" /> rocketId
          </span>
          <span>Tu identidad outdoor · Hecho en Chile 🇨🇱</span>
        </div>
      </footer>
    </div>
  )
}

// ---------- Navegación ----------

function Nav({ ctaTo, loggedIn }: { ctaTo: string; loggedIn: boolean }) {
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-line/70 bg-surface/90 backdrop-blur">
      <nav aria-label="Principal" className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <a href="#inicio" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Logo className="size-8 rounded-lg" />
          rocketId
        </a>
        <ul className="ml-auto hidden items-center gap-1 text-sm font-medium text-fg-soft md:flex">
          {[
            ['#como-funciona', 'Cómo funciona'],
            ['#para-quien', 'Para quién'],
            ['#historias', 'Historias'],
            ['#preguntas', 'Preguntas'],
          ].map(([href, label]) => (
            <li key={href}>
              <a href={href} className="flex h-11 items-center rounded-lg px-3 active:bg-line/60 hover:text-fg">
                {label}
              </a>
            </li>
          ))}
        </ul>
        <Link
          to={ctaTo}
          className="ml-auto flex h-11 items-center rounded-xl border border-field px-4 text-sm font-semibold text-primary-text active:bg-line/60 md:ml-2"
        >
          {loggedIn ? 'Abrir app' : 'Iniciar sesión'}
        </Link>
      </nav>
    </header>
  )
}

// ---------- Hero ----------

function Hero({ ctaTo, ctaLabel }: { ctaTo: string; ctaLabel: string }) {
  return (
    <section id="inicio" className="relative overflow-hidden">
      <div className="absolute inset-0 -z-0 bg-gradient-to-b from-primary/10 to-transparent" aria-hidden="true" />
      <Mountains className="absolute inset-x-0 bottom-0 h-40 w-full text-primary/10" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-16 md:grid-cols-2 md:pt-16 md:pb-24">
        <div>
          <p className="text-sm font-semibold tracking-wide text-primary-text uppercase">{HERO.eyebrow}</p>
          <h1 className="mt-3 text-4xl leading-[1.1] font-extrabold tracking-tight text-balance sm:text-5xl">{HERO.title}</h1>
          <p className="mt-4 max-w-prose text-lg text-fg-soft">{HERO.subtitle}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              to={ctaTo}
              className="flex h-12 items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-white shadow-lg shadow-primary/25 active:bg-primary-dark"
            >
              {ctaLabel}
            </Link>
            <a
              href="#como-funciona"
              className="flex h-12 items-center justify-center rounded-xl border border-field bg-card px-6 text-base font-semibold text-fg active:bg-line/60"
            >
              {HERO.secondary}
            </a>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg-soft">
            {HERO.trust.map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <span className="text-primary-text" aria-hidden="true">
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex justify-center">
          <PhoneFrame label="Pantalla de inicio de rocketId con el resumen de preparación" className="z-10">
            <ScreenHome />
          </PhoneFrame>
          <PhoneFrame
            label="Ficha de emergencia en rocketId"
            className="absolute top-12 -right-2 hidden scale-90 rotate-6 opacity-95 lg:block"
          >
            <ScreenFicha />
          </PhoneFrame>
        </div>
      </div>
    </section>
  )
}

function Mountains({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 160" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d="M0 160 L0 110 L150 40 L260 100 L420 10 L560 90 L700 30 L860 105 L1000 45 L1200 120 L1200 160 Z" fill="currentColor" />
    </svg>
  )
}

// ---------- Secciones ----------

function Section({ id, eyebrow, title, intro, children, className = '' }: { id?: string; eyebrow: string; title: string; intro?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-16 py-16 md:py-24 ${className}`}>
      <div className="mx-auto max-w-6xl px-4">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-primary-text uppercase">{eyebrow}</p>
          <h2 className="mt-2 text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl">{title}</h2>
          {intro && <p className="mt-3 max-w-prose text-lg text-fg-soft">{intro}</p>}
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  )
}

function Pains() {
  return (
    <Section eyebrow="El problema" title="¿Te suena?" intro="Las salidas outdoor se organizan con buena voluntad… y con información dispersa.">
      <ul className="grid gap-4 md:grid-cols-3">
        {PAINS.map((p) => (
          <li key={p.title} className="flex flex-col rounded-2xl border border-line bg-card p-5 shadow-sm">
            <span className="text-3xl" aria-hidden="true">
              {p.icon}
            </span>
            <h3 className="mt-3 text-lg font-bold">{p.title}</h3>
            <p className="mt-1 text-base text-fg-soft">{p.pain}</p>
            <p className="mt-4 flex gap-2 rounded-xl bg-primary/5 p-3 text-base font-medium text-primary-text">
              <span aria-hidden="true">→</span>
              {p.fix}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function HowItWorks() {
  return (
    <Section id="como-funciona" eyebrow="Cómo funciona" title="Tres pasos y listo para salir" className="bg-card/60">
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded-2xl border border-line bg-card p-5 shadow-sm">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">{s.n}</span>
            <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
            <p className="mt-1 text-base text-fg-soft">{s.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

function Features() {
  return (
    <Section eyebrow="Lo que puedes hacer" title="Todo lo que tu salida necesita saber de ti">
      <div className="space-y-16 md:space-y-24">
        {FEATURES.map((f, i) => {
          const Screen = SCREENS[f.id]
          return (
            <article key={f.id} className="grid items-center gap-8 md:grid-cols-2">
              <div className={i % 2 ? 'md:order-2' : ''}>
                <p className="text-sm font-semibold text-primary-text">{f.eyebrow}</p>
                <h3 className="mt-1 text-2xl leading-tight font-extrabold tracking-tight">{f.title}</h3>
                <p className="mt-3 max-w-prose text-base text-fg-soft">{f.text}</p>
                <ul className="mt-4 space-y-2">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex gap-2 text-base">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary-text" aria-hidden="true">
                        ✓
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-center">
                <PhoneFrame label={`${f.eyebrow} en rocketId`}>
                  <Screen />
                </PhoneFrame>
              </div>
            </article>
          )
        })}
      </div>
    </Section>
  )
}

function UseCases() {
  return (
    <Section id="para-quien" eyebrow="Para quién es" title="Casos de uso" intro="rocketId se adapta a cómo vives el outdoor: si sales, si organizas, si guías o si formas." className="bg-card/60">
      <ul className="grid gap-4 sm:grid-cols-2">
        {USE_CASES.map((u) => (
          <li key={u.who} className="flex flex-col rounded-2xl border border-line bg-card p-5 shadow-sm">
            <span className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl" aria-hidden="true">
                {u.icon}
              </span>
              <span>
                <span className="block text-sm font-semibold text-primary-text">{u.who}</span>
                <span className="block text-lg font-bold">{u.title}</span>
              </span>
            </span>
            <p className="mt-3 text-base text-fg-soft">{u.text}</p>
            <ul className="mt-4 space-y-1.5 border-t border-line pt-4">
              {u.points.map((p) => (
                <li key={p} className="flex gap-2 text-base">
                  <span className="text-primary-text" aria-hidden="true">
                    •
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function Stories() {
  return (
    <Section id="historias" eyebrow="Historias" title="Momentos en que rocketId marca la diferencia" intro="Cuatro escenas cortas de lo que pasa cuando la información correcta está en el lugar correcto.">
      <ul className="grid gap-6 md:grid-cols-2">
        {STORIES.map((s) => (
          <li key={s.id}>
            <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-sm">
              <SceneIllustration scene={s.scene} title={`Ilustración: ${s.place}`} />
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <span className="w-fit rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary-text">{s.tag}</span>
                <h3 className="mt-3 text-xl leading-snug font-extrabold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.place}</p>
                <div className="mt-4 max-w-prose space-y-3 text-base leading-relaxed text-fg-soft">
                  {s.body.map((p) => (
                    <p key={p.slice(0, 24)}>{p}</p>
                  ))}
                </div>
                <p className="mt-auto flex gap-2 rounded-xl bg-primary/5 p-3 pt-3 text-base font-semibold text-primary-text">
                  <span aria-hidden="true">✨</span>
                  {s.outcome}
                </p>
              </div>
            </article>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">Historias ilustrativas: personajes ficticios inspirados en situaciones habituales del outdoor.</p>
    </Section>
  )
}

function Privacy() {
  return (
    <Section eyebrow="Privacidad" title="Tus datos, bajo tu control" intro="Tu ficha contiene información sensible. Por eso rocketId está diseñado para que nada se comparta sin que tú lo sepas." className="bg-card/60">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <ul className="space-y-4">
          {PRIVACY.map((p) => (
            <li key={p.title} className="flex gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl" aria-hidden="true">
                {p.icon}
              </span>
              <span>
                <span className="block text-base font-bold">{p.title}</span>
                <span className="block text-base text-fg-soft">{p.text}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-center">
          <PhoneFrame label="Perfil público de deportista en rocketId">
            <ScreenProfile />
          </PhoneFrame>
        </div>
      </div>
    </Section>
  )
}

function Faq() {
  return (
    <Section id="preguntas" eyebrow="Preguntas frecuentes" title="Lo que suelen preguntarnos">
      <ul className="max-w-3xl divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {FAQ.map((f) => (
          <li key={f.q}>
            <details className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 py-3 text-base font-semibold active:bg-line/60 [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{f.q}</span>
                <span className="text-xl text-muted transition-transform group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="max-w-prose px-5 pb-5 text-base text-fg-soft">{f.a}</p>
            </details>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function FinalCta({ ctaTo, ctaLabel }: { ctaTo: string; ctaLabel: string }) {
  const { canInstall, installed, isIOS, install } = useInstallPrompt()
  const [showIOS, setShowIOS] = useState(false)
  return (
    <section className="px-4 py-16 md:py-24">
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl bg-gradient-to-br from-primary-dark to-primary px-6 py-12 text-center text-white shadow-xl shadow-primary/25 sm:px-12">
        <Mountains className="absolute inset-x-0 bottom-0 h-24 w-full text-white/10" />
        <div className="relative">
          <Logo className="mx-auto size-14 rounded-2xl ring-2 ring-white/30" />
          <h2 className="mt-5 text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl">Tu próxima salida empieza preparada</h2>
          <p className="mx-auto mt-3 max-w-prose text-lg">Crea tu rocketId en menos de cinco minutos. Es gratis.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to={ctaTo} className="flex h-12 items-center justify-center rounded-xl bg-white px-6 text-base font-bold text-primary-text shadow-lg active:bg-white/90">
              {ctaLabel}
            </Link>
            {!installed && (canInstall || isIOS) && (
              <button
                type="button"
                onClick={() => (canInstall ? install() : setShowIOS((v) => !v))}
                aria-expanded={isIOS ? showIOS : undefined}
                className="flex h-12 items-center justify-center rounded-xl border border-white/60 px-6 text-base font-semibold text-white active:bg-white/10"
              >
                📲 Instalar en mi teléfono
              </button>
            )}
          </div>
          {showIOS && (
            <p className="mx-auto mt-4 max-w-sm rounded-xl bg-white/15 p-3 text-base">
              En Safari toca <strong>Compartir</strong> <span aria-hidden="true">⬆️</span> y luego <strong>“Agregar a pantalla de inicio”</strong>.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
