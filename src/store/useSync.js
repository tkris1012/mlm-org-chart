import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { auth, db } from '../lib/firebase.js'
import { useStore } from './useStore.js'
import {
  getShareTokenInfo,
  getShareConfig,
  subscribePublicMembers,
  subscribeShareConfig,
} from '../lib/firestore.js'

export function useSync() {
  const setUser        = useStore((s) => s.setUser)
  const setMembers     = useStore((s) => s.setMembers)
  const setViewMode    = useStore((s) => s.setViewMode)
  const setShareConfig = useStore((s) => s.setShareConfig)

  useEffect(() => {
    // ?s=<token> 検知 → 閲覧モード
    const params = new URLSearchParams(window.location.search)
    const shareToken = params.get('s')

    if (shareToken) {
      setViewMode('view')
      let unsubMembers = null

      ;(async () => {
        try {
          const tokenInfo = await getShareTokenInfo(shareToken)
          if (!tokenInfo) {
            console.warn('Share token not found')
            setMembers({})
            return
          }
          const { uid } = tokenInfo
          const cfg = await getShareConfig(uid)
          if (!cfg?.enabled) {
            console.warn('Share is disabled')
            setMembers({})
            return
          }
          unsubMembers = subscribePublicMembers(uid, setMembers)
        } catch (e) {
          console.error('Share view init failed', e)
        }
      })()

      return () => { if (unsubMembers) unsubMembers() }
    }

    // 通常（オーナー）モード
    setViewMode('owner')
    let unsubMembers = null
    let unsubShare   = null

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setUser(user)

      if (unsubMembers) { unsubMembers(); unsubMembers = null }
      if (unsubShare)   { unsubShare();   unsubShare   = null }

      if (!user) {
        setMembers({})
        setShareConfig(null)
        return
      }

      // メンバー購読
      const q = query(collection(db, 'users', user.uid, 'members'))
      unsubMembers = onSnapshot(q, (snap) => {
        const map = {}
        snap.forEach((d) => { map[d.id] = { id: d.id, ...d.data() } })
        setMembers(map)
      })

      // 共有設定購読
      unsubShare = subscribeShareConfig(user.uid, (cfg) => {
        setShareConfig(cfg ?? { enabled: false, token: null })
      })
    })

    return () => {
      unsubAuth()
      if (unsubMembers) unsubMembers()
      if (unsubShare)   unsubShare()
    }
  }, [setUser, setMembers, setViewMode, setShareConfig])
}
