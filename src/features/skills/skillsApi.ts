import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { normalizeSkills, parseSkills, type SkillsData } from './schema'

const skillsRef = (uid: string) => doc(db, 'users', uid, 'private', 'skills')

export function subscribeSkills(uid: string, cb: (s: SkillsData) => void) {
  return onSnapshot(skillsRef(uid), (snap) => cb(parseSkills(snap.data())))
}

export function saveSkills(uid: string, s: SkillsData) {
  return setDoc(skillsRef(uid), { ...normalizeSkills(s), updatedAt: serverTimestamp() })
}
