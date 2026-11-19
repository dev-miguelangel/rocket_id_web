import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { subscribeContacts, type Contact } from '../contacts/contactsApi'
import { getPublicProfile } from '../contacts/publicProfile'
import { subscribeMyApplications } from '../courses/applicationsApi'
import { useCatalog } from '../courses/useCatalog'
import type { Application } from '../courses/schema'
import { fetchMyEvents, fetchPublicEvents } from '../events/eventsApi'
import type { EventDoc } from '../events/schema'
import { subscribeProfile } from '../profile/profileApi'
import { CRITICAL_FIELDS, type ProfileForm } from '../profile/schema'
import type { SkillsData, Verifications } from '../skills/schema'
import { subscribeSkills, subscribeVerifications } from '../skills/skillsApi'
import { computeStats, pickActiveEvent, recommendCourses, recommendEvents, type MyEventRow } from './insights'

/** Máximo de perfiles de la cordada que se consultan para las recomendaciones */
const CORDADA_SAMPLE = 25

/** Reúne los datos del Inicio y calcula estadísticas y recomendaciones en el dispositivo. */
export function useHomeData() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<ProfileForm | null>(null)
  const [skills, setSkills] = useState<SkillsData | null>(null)
  const [verifications, setVerifications] = useState<Verifications>({})
  const [contacts, setContacts] = useState<Contact[] | null>(null)
  const [cordada, setCordada] = useState<{ uid: string; displayName: string; skills: SkillsData }[]>([])
  const [myEvents, setMyEvents] = useState<MyEventRow[] | null>(null)
  const [publicEvents, setPublicEvents] = useState<EventDoc[]>([])
  const [apps, setApps] = useState<Application[]>([])

  useEffect(() => {
    if (!user) return
    const unsubs = [
      subscribeProfile(user.uid, (p, d) => setProfile({ ...p, fullName: p.fullName || d.name, contactEmail: p.contactEmail || d.email })),
      subscribeSkills(user.uid, setSkills),
      subscribeVerifications(user.uid, setVerifications),
      subscribeContacts(user.uid, setContacts),
      subscribeMyApplications(user.uid, setApps),
    ]
    let alive = true
    fetchMyEvents(user.uid)
      .then((r) => alive && setMyEvents(r))
      .catch(() => alive && setMyEvents([]))
    fetchPublicEvents()
      .then((r) => alive && setPublicEvents(r))
      .catch(() => {})
    return () => {
      alive = false
      unsubs.forEach((u) => u())
    }
  }, [user])

  // Perfiles públicos de la cordada (conocimientos actualizados)
  const contactKey = contacts?.map((c) => c.uid).join(',') ?? ''
  useEffect(() => {
    const uids = contactKey ? contactKey.split(',').slice(0, CORDADA_SAMPLE) : []
    if (!uids.length) return
    let alive = true
    Promise.all(uids.map((uid) => getPublicProfile(uid).catch(() => null))).then((rs) => {
      if (!alive) return
      setCordada(rs.filter((r): r is NonNullable<typeof r> => !!r).map((r) => ({ uid: r.profile.uid, displayName: r.profile.displayName, skills: r.profile.skills })))
    })
    return () => {
      alive = false
    }
  }, [contactKey])

  const loading = !profile || myEvents === null || contacts === null
  const catalog = useCatalog()
  const cordadaInUse = useMemo(() => (contacts?.length ? cordada : []), [contacts, cordada])

  return useMemo(() => {
    if (loading || !user) return { loading: true as const }
    const ctx = {
      skills,
      myEvents: myEvents ?? [],
      cordada: cordadaInUse,
      appliedCourseIds: new Set(apps.map((a) => a.courseId)),
    }
    return {
      loading: false as const,
      stats: computeStats({
        profile,
        skills,
        verifications,
        myEvents: myEvents ?? [],
        cordada: cordadaInUse,
        cordadaSize: contacts?.length ?? 0,
        applications: apps.length,
      }),
      courseRecs: recommendCourses(catalog, ctx),
      eventRecs: recommendEvents(publicEvents, { ...ctx, myUid: user.uid }),
      activeEvent: pickActiveEvent(myEvents ?? []),
      setup: {
        profileDone: CRITICAL_FIELDS.every(({ key }) => !!profile?.[key]?.trim()),
        skillsAnswered: skills?.hasCertifications === 'yes' || skills?.hasCertifications === 'no',
        hasCordada: (contacts?.length ?? 0) > 0,
        hasEvent: (myEvents ?? []).length > 0,
      },
    }
  }, [loading, user, profile, skills, verifications, myEvents, cordadaInUse, contacts, apps, publicEvents, catalog])
}
