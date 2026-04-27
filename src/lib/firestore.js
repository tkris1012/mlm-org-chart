import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase.js'

const membersCol = (uid) => collection(db, 'users', uid, 'members')
const memberDoc = (uid, memberId) => doc(db, 'users', uid, 'members', memberId)
const shareConfigDoc = (uid) => doc(db, 'users', uid, '_meta', 'share')
const shareTokenDoc = (token) => doc(db, 'shareTokens', token)

// 12文字のランダムトークン生成
function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let token = ''
  for (let i = 0; i < 12; i++) token += chars[Math.floor(Math.random() * chars.length)]
  return token
}

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

// === 共有リンク関連 ===========================================

export async function getShareConfig(uid) {
  const snap = await getDoc(shareConfigDoc(uid))
  return snap.exists() ? snap.data() : null
}

// 共有 ON/OFF を切り替える。トークンがなければ自動生成。
export async function setShareEnabled(uid, enabled) {
  const cur = await getShareConfig(uid)
  let token = cur?.token
  if (!token) {
    token = generateToken()
    await setDoc(shareTokenDoc(token), { uid, createdAt: serverTimestamp() })
  }
  await setDoc(shareConfigDoc(uid), {
    enabled,
    token,
    updatedAt: serverTimestamp(),
  })
  return { enabled, token }
}

// トークンを再発行（古いURLは即無効）
export async function regenerateShareToken(uid) {
  const cur = await getShareConfig(uid)
  if (cur?.token) {
    try { await deleteDoc(shareTokenDoc(cur.token)) } catch (_) { /* noop */ }
  }
  const token = generateToken()
  await setDoc(shareTokenDoc(token), { uid, createdAt: serverTimestamp() })
  await setDoc(shareConfigDoc(uid), {
    enabled: true,
    token,
    updatedAt: serverTimestamp(),
  })
  return { enabled: true, token }
}

// トークン → uid のルックアップ（閲覧者用）
export async function getShareTokenInfo(token) {
  const snap = await getDoc(shareTokenDoc(token))
  return snap.exists() ? snap.data() : null
}

// 公開メンバーを購読（閲覧者用）
export function subscribePublicMembers(uid, callback) {
  return onSnapshot(membersCol(uid), (snap) => {
    const map = {}
    snap.forEach((d) => { map[d.id] = { id: d.id, ...d.data() } })
    callback(map)
  })
}

// 共有設定を購読（オーナー用、外部からの変更も反映）
export function subscribeShareConfig(uid, callback) {
  return onSnapshot(shareConfigDoc(uid), (snap) => {
    callback(snap.exists() ? snap.data() : null)
  })
}
