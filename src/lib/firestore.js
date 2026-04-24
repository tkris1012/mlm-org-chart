import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase.js'

const membersCol = (uid) => collection(db, 'users', uid, 'members')
const memberDoc = (uid, memberId) => doc(db, 'users', uid, 'members', memberId)

export async function addMember(uid, data) {
  const ref = await addDoc(membersCol(uid), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateMember(uid, memberId, data) {
  await updateDoc(memberDoc(uid, memberId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteMember(uid, memberId) {
  await deleteDoc(memberDoc(uid, memberId))
}

export async function deleteMembers(uid, memberIds) {
  await Promise.all(memberIds.map((id) => deleteDoc(memberDoc(uid, id))))
}

// undo用：元のドキュメントIDを保持したまま復元
export async function restoreMember(uid, memberId, data) {
  await setDoc(memberDoc(uid, memberId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}
