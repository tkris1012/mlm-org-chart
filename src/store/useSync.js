import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { auth, db } from '../lib/firebase.js'
import { useStore } from './useStore.js'

export function useSync() {
  const setUser = useStore((s) => s.setUser)
  const setMembers = useStore((s) => s.setMembers)

  useEffect(() => {
    let unsubSnapshot = null

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setUser(user)

      if (unsubSnapshot) {
        unsubSnapshot()
        unsubSnapshot = null
      }

      if (!user) {
        setMembers({})
        return
      }

      const q = query(collection(db, 'users', user.uid, 'members'))

      unsubSnapshot = onSnapshot(q, (snap) => {
        const map = {}
        snap.forEach((docSnap) => {
          map[docSnap.id] = { id: docSnap.id, ...docSnap.data() }
        })
        setMembers(map)
      })
    })

    return () => {
      unsubAuth()
      if (unsubSnapshot) unsubSnapshot()
    }
  }, [setUser, setMembers])
}
