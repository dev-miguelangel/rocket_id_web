import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { RocketIdBadge } from "../../components/RocketIdBadge";
import { firstName } from "../../lib/names";
import { useAuth } from "../auth/AuthProvider";
import { useRocketId } from "../auth/useRocketId";
import { formatDateRange, formatPrice, type Course } from "../courses/schema";
import { EmergencySheet } from "../events/EmergencySheet";
import { activityOf, formatEventDate, type EventDoc } from "../events/schema";
import type { MyEventRow, Recommendation, Stats } from "../home/insights";
import { useHomeData } from "../home/useHomeData";
import { categoryOf, formatMonth } from "../skills/schema";

export function HomePage() {
  const { user } = useAuth();
  const name = firstName(user?.displayName);
  const rocketId = useRocketId();
  const data = useHomeData();

  const active = !data.loading ? data.activeEvent : null;

  return (
    <div className="space-y-6 pb-4">
      {active ? (
        <ActiveEventCard row={active} />
      ) : (
        <section className="rounded-3xl bg-gradient-to-br from-primary-dark to-primary p-5 text-white shadow-lg shadow-primary/20">
          <p className="text-sm font-medium">Bienvenido de vuelta</p>
          <h2 className="mt-1 text-2xl font-bold">Hola, {name} 👋</h2>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs font-medium tracking-wide uppercase">
              Tu rocketId
            </span>
            <RocketIdBadge rocketId={rocketId} variant="light" />
          </div>
        </section>
      )}

      {data.loading ? (
        <HomeSkeleton />
      ) : (
        <>
          <FirstSteps setup={data.setup} />
          <StatsGrid stats={data.stats} />
          <Attention stats={data.stats} />
          <Recommendations courses={data.courseRecs} events={data.eventRecs} />
        </>
      )}
    </div>
  );
}

// ---------- Evento en curso ----------

function timeLabel(start: Date, end: Date, now: number) {
  const t = (d: Date) =>
    d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  const mins = (ms: number) => Math.max(1, Math.round(ms / 60_000));
  const span = (m: number) =>
    m < 60
      ? `${m} min`
      : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
  if (now < start.getTime())
    return {
      badge: "Empieza pronto",
      text: `Comienza en ${span(mins(start.getTime() - now))} · ${t(start)}`,
    };
  if (now <= end.getTime())
    return {
      badge: "En curso",
      text: `Termina a las ${t(end)} · quedan ${span(mins(end.getTime() - now))}`,
    };
  return { badge: "Recién terminó", text: `Terminó a las ${t(end)}` };
}

/** Reemplaza la bienvenida mientras la persona participa en un evento activo */
function ActiveEventCard({ row }: { row: MyEventRow }) {
  const e = row.event;
  const [now, setNow] = useState(() => Date.now());
  const [sos, setSos] = useState(false);
  const close = useCallback(() => setSos(false), []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const a = activityOf(e.activity);
  const { badge, text } = timeLabel(e.startAt, e.endAt, now);
  const ongoing = badge === "En curso";

  return (
    <section
      aria-label={`Evento ${badge.toLowerCase()}: ${e.title}`}
      className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary-dark to-primary text-white shadow-lg shadow-primary/20"
    >
      <div className="p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold tracking-wide uppercase">
            {ongoing && (
              <span
                className="size-2 rounded-full bg-emerald-300 motion-safe:animate-pulse"
                aria-hidden="true"
              />
            )}
            {badge}
          </span>
          <span className="ml-auto">
            {a.icon} {a.label}
          </span>
        </div>
        <h2 className="mt-3 text-2xl leading-tight font-bold">{e.title}</h2>
        <p className="mt-2 text-base">⏱️ {text}</p>
        <p className="text-base">📍 {e.location}</p>
        {e.meetingPoint && <p className="text-base">🚩 {e.meetingPoint}</p>}
        {row.me.role === "organizer" && (
          <p className="mt-2 text-sm font-medium">Organizas esta salida</p>
        )}
      </div>
      {/* El botón de emergencia solo existe mientras el evento está ocurriendo (inicio → término) */}
      <div
        className={`grid gap-2 bg-black/15 p-3 ${ongoing ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1"}`}
      >
        {ongoing && (
          <button
            type="button"
            onClick={() => setSos(true)}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-red-600 text-lg font-extrabold tracking-wide text-white shadow-lg shadow-red-950/30 active:bg-red-700"
          >
            🆘 EMERGENCIA
          </button>
        )}
        <Link
          to={`/e/${e.id}`}
          className={`flex items-center justify-center rounded-2xl px-4 font-semibold active:opacity-80 ${
            ongoing
              ? "h-14 bg-white/15 text-base text-white ring-1 ring-white/30"
              : "h-12 bg-white text-base text-primary-text"
          }`}
        >
          Ver evento
        </Link>
      </div>
      {ongoing && <EmergencySheet event={e} open={sos} onClose={close} />}
    </section>
  );
}

// ---------- Primeros pasos ----------

interface Setup {
  profileDone: boolean;
  skillsAnswered: boolean;
  hasCordada: boolean;
  hasEvent: boolean;
}

function FirstSteps({ setup }: { setup: Setup }) {
  const { user } = useAuth();
  const key = `rocketid-setup-dismissed:${user?.uid}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  const qrSaved = (() => {
    try {
      return localStorage.getItem("rocketid-qr-saved") === "1";
    } catch {
      return false;
    }
  })();
  const steps = [
    {
      done: setup.profileDone,
      icon: "🩺",
      title: "Completa tu ficha de emergencia",
      to: "/mis-datos",
    },
    {
      done: setup.skillsAnswered,
      icon: "🎓",
      title: "Registra tu formación",
      to: "/mis-datos",
    },
    {
      done: setup.hasCordada,
      icon: "🪢",
      title: "Suma a alguien a tu cordada",
      to: "/cordada",
    },
    {
      done: setup.hasEvent,
      icon: "🏔️",
      title: "Únete o crea una salida",
      to: "/eventos",
    },
    {
      done: qrSaved,
      icon: "🆘",
      title: "Guarda tu tarjeta de emergencia QR",
      to: "/mis-datos",
    },
  ];
  const doneCount = steps.filter((x) => x.done).length;
  if (dismissed || doneCount === steps.length) return null;

  const hide = () => {
    setDismissed(true);
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignorar */
    }
  };

  return (
    <section
      aria-labelledby="setup-title"
      className="rounded-2xl border border-line bg-card p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="setup-title" className="text-base font-bold text-fg">
            Primeros pasos
          </h2>
          <p className="text-sm text-muted">
            {doneCount} de {steps.length} listos para tu próxima salida
          </p>
        </div>
        <button
          type="button"
          onClick={hide}
          className="-my-2 -mr-2 h-11 rounded-lg px-3 text-sm font-medium text-muted active:bg-line/60"
        >
          Ocultar
        </button>
      </div>
      <span
        className="mt-3 block h-2 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={doneCount}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-label="Progreso de primeros pasos"
      >
        <span
          className="block h-full rounded-full bg-primary transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </span>
      <ul className="mt-3 divide-y divide-line">
        {steps.map((x) => (
          <li key={x.title}>
            <Link
              to={x.to}
              className="flex min-h-12 items-center gap-3 py-2 active:opacity-60"
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${x.done ? "bg-emerald-600 text-white" : "bg-surface text-base ring-1 ring-field"}`}
                aria-hidden="true"
              >
                {x.done ? "✓" : x.icon}
              </span>
              <span
                className={`flex-1 text-base ${x.done ? "text-muted line-through" : "font-medium text-fg"}`}
              >
                {x.title}
                <span className="sr-only">
                  {x.done ? " (listo)" : " (pendiente)"}
                </span>
              </span>
              {!x.done && (
                <span className="text-lg text-muted" aria-hidden="true">
                  ›
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Tu preparación ----------

function StatsGrid({ stats: s }: { stats: Stats }) {
  return (
    <section aria-labelledby="stats-title">
      <h2 id="stats-title" className="mb-2 px-1 text-base font-bold text-fg">
        Tu preparación
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          to="/mis-datos"
          icon="🩺"
          label="Ficha de emergencia"
          value={`${s.profilePct}%`}
        >
          <Progress value={s.profilePct} />
          <span className="mt-1.5 block">
            {s.profilePct === 100
              ? "Completa"
              : `Faltan ${s.missingFields.length} datos`}
          </span>
        </StatCard>
        <StatCard
          to="/mis-datos"
          icon="🎓"
          label="Certificaciones vigentes"
          value={String(s.certsActive)}
        >
          {s.certsVerified > 0
            ? `${s.certsVerified} verificada${s.certsVerified === 1 ? "" : "s"}`
            : "Sin verificar aún"}
        </StatCard>
        <StatCard
          to="/eventos"
          icon="🏔️"
          label="Próximas salidas"
          value={String(s.eventsUpcoming)}
        >
          {s.eventsAttended > 0
            ? `${s.eventsAttended} realizada${s.eventsAttended === 1 ? "" : "s"}`
            : s.eventsOrganizing
              ? `Organizas ${s.eventsOrganizing}`
              : "Aún sin salidas"}
        </StatCard>
        <StatCard
          to="/cordada"
          icon="🪢"
          label="Tu cordada"
          value={String(s.cordadaSize)}
        >
          {s.cordadaSize
            ? `${s.cordadaFirstAid} con primeros auxilios`
            : "Agrega compañeros"}
        </StatCard>
      </div>
    </section>
  );
}

function StatCard({
  to,
  icon,
  label,
  value,
  children,
}: {
  to: string;
  icon: string;
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-32 flex-col rounded-2xl border border-line bg-card p-4 shadow-sm transition active:scale-[0.98]"
    >
      <span className="flex items-center justify-between">
        <span className="text-xl" aria-hidden="true">
          {icon}
        </span>
        <span className="text-2xl leading-none font-extrabold text-fg tabular-nums">
          {value}
        </span>
      </span>
      <span className="mt-2 text-sm font-semibold text-fg">{label}</span>
      <span className="mt-auto pt-1 text-sm text-muted">{children}</span>
    </Link>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <span
      className="block h-2 overflow-hidden rounded-full bg-line"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Ficha completa"
    >
      <span
        className={`block h-full rounded-full ${value === 100 ? "bg-emerald-600" : "bg-primary"}`}
        style={{ width: `${value}%` }}
      />
    </span>
  );
}

// ---------- Requiere tu atención ----------

type Tone = "warn" | "info" | "danger";
const TONES: Record<Tone, string> = {
  warn: "bg-amber-100 dark:bg-amber-500/15",
  info: "bg-sky-100 dark:bg-sky-500/15",
  danger: "bg-red-100 dark:bg-red-500/15",
};

function Attention({ stats: s }: { stats: Stats }) {
  const items: {
    key: string;
    icon: string;
    title: string;
    text: string;
    to: string;
    tone: Tone;
  }[] = [];
  if (s.profilePct < 100)
    items.push({
      key: "profile",
      icon: "🩺",
      title: "Completa tu ficha de emergencia",
      text: `Falta: ${s.missingFields.slice(0, 3).join(", ")}${s.missingFields.length > 3 ? "…" : ""}`,
      to: "/mis-datos",
      tone: "warn",
    });
  for (const r of s.eventsPendingInvites.slice(0, 2))
    items.push({
      key: `inv-${r.event.id}`,
      icon: "📩",
      title: `Te invitaron a “${r.event.title}”`,
      text: `${formatEventDate(r.event.startAt, r.event.endAt)} · responde la invitación`,
      to: `/e/${r.event.id}`,
      tone: "info",
    });
  for (const c of s.certsExpired.slice(0, 2))
    items.push({
      key: `exp-${c.id}`,
      icon: "⛔",
      title: `“${c.name}” está vencida`,
      text: "Actualiza su estado o renuévala",
      to: "/mis-datos",
      tone: "danger",
    });
  for (const c of s.certsExpiring.slice(0, 2))
    items.push({
      key: `soon-${c.id}`,
      icon: "⏳",
      title: `“${c.name}” vence pronto`,
      text: `Vence en ${formatMonth(c.expiresAt)}`,
      to: "/mis-datos",
      tone: "warn",
    });
  if (!items.length) return null;

  return (
    <section aria-labelledby="attention-title">
      <h2
        id="attention-title"
        className="mb-2 px-1 text-base font-bold text-fg"
      >
        Requiere tu atención
      </h2>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {items.map((i) => (
          <li key={i.key}>
            <Link
              to={i.to}
              className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-line/60"
            >
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-full text-lg ${TONES[i.tone]}`}
                aria-hidden="true"
              >
                {i.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium text-fg">
                  {i.title}
                </span>
                <span className="block text-sm text-muted">{i.text}</span>
              </span>
              <span className="text-lg text-muted" aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Recomendados ----------

function Recommendations({
  courses,
  events,
}: {
  courses: Recommendation<Course>[];
  events: Recommendation<EventDoc>[];
}) {
  if (!courses.length && !events.length)
    return (
      <section className="rounded-2xl border border-dashed border-line-strong bg-card px-6 py-8 text-center">
        <p className="text-3xl" aria-hidden="true">
          🧭
        </p>
        <p className="mt-2 font-semibold text-fg">
          Pronto tendrás recomendaciones
        </p>
        <p className="mt-1 text-sm text-muted">
          Agrega tus certificaciones y tu cordada para recibir sugerencias de
          cursos y salidas.
        </p>
      </section>
    );
  return (
    <>
      {events.length > 0 && (
        <Carousel
          title="Salidas para ti"
          subtitle="Según tu historial y tu cordada"
          seeAll={{ to: "/eventos", label: "Ver eventos" }}
        >
          {events.map((r) => (
            <RecoCard
              key={r.item.id}
              to={`/e/${r.item.id}`}
              icon={activityOf(r.item.activity).icon}
              title={r.item.title}
              meta={`${formatEventDate(r.item.startAt, r.item.endAt)} · ${r.item.location}`}
              reason={r.reason}
            />
          ))}
        </Carousel>
      )}
      {courses.length > 0 && (
        <Carousel
          title="Cursos recomendados"
          subtitle="Para ti y la seguridad de tu cordada"
          seeAll={{ to: "/cursos", label: "Ver cursos" }}
        >
          {courses.map((r) => (
            <RecoCard
              key={r.item.id}
              to={`/cursos?curso=${r.item.id}`}
              icon={categoryOf(r.item.category)?.icon ?? "🎓"}
              title={r.item.title}
              meta={`${formatDateRange(r.item.startDate, r.item.endDate)} · ${formatPrice(r.item.priceCLP)}`}
              reason={r.reason}
            />
          ))}
        </Carousel>
      )}
    </>
  );
}

function Carousel({
  title,
  subtitle,
  seeAll,
  children,
}: {
  title: string;
  subtitle: string;
  seeAll: { to: string; label: string };
  children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-base font-bold text-fg">{title}</h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        <Link
          to={seeAll.to}
          className="-my-2 flex h-11 shrink-0 items-center rounded-lg px-2 text-sm font-medium text-primary-text active:opacity-60"
        >
          {seeAll.label}
        </Link>
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-0.5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </ul>
    </section>
  );
}

function RecoCard({
  to,
  icon,
  title,
  meta,
  reason,
}: {
  to: string;
  icon: string;
  title: string;
  meta: string;
  reason: string;
}) {
  return (
    <li className="w-72 max-w-[80vw] shrink-0 snap-start">
      <Link
        to={to}
        className="flex h-full flex-col rounded-2xl border border-line bg-card p-4 shadow-sm transition active:scale-[0.98]"
      >
        <span className="flex items-start gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl"
            aria-hidden="true"
          >
            {icon}
          </span>
          <span className="min-w-0">
            <span className="line-clamp-2 block text-base leading-snug font-semibold text-fg">
              {title}
            </span>
            <span className="mt-0.5 block truncate text-sm text-muted">
              {meta}
            </span>
          </span>
        </span>
        <span className="mt-auto flex items-start gap-1.5 rounded-lg bg-primary/5 px-3 py-2 text-sm font-medium text-primary-text">
          <span aria-hidden="true">✨</span>
          <span>{reason}</span>
        </span>
      </Link>
    </li>
  );
}

function HomeSkeleton() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Cargando tu resumen"
    >
      <div>
        <div className="mb-2 ml-1 h-4 w-32 animate-pulse rounded bg-line" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-line" />
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 ml-1 h-4 w-40 animate-pulse rounded bg-line" />
        <div className="flex gap-3 overflow-hidden">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-36 w-72 shrink-0 animate-pulse rounded-2xl bg-line"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
