import { create } from 'zustand'
import { addMember, updateMember, deleteMember, deleteMembers, restoreMember } from '../lib/firestore.js'

const MAX_UNDO = 20

// 子孫IDを全取得
function collectDescendants(members, rootId) {
  const result = []
  const queue = [rootId]
  while (queue.length) {
    const id = queue.shift()
    const children = Object.values(members).filter((m) => m.parentId === id)
    for (const c of children) {
      result.push(c.id)
      queue.push(c.id)
    }
  }
  return result
}

// 祖先IDセットを取得（循環参照チェック用）
function getAncestors(members, id) {
  const ancestors = new Set()
  let cur = members[id]
  while (cur?.parentId) {
    ancestors.add(cur.parentId)
    cur = members[cur.parentId]
  }
  return ancestors
}

export const useStore = create((set, get) => ({
  // --- Auth ---
  user: null,
  setUser: (user) => set({ user }),

  // --- Members ---
  members: {},          // { [id]: { id, name, role, photo, parentId, position } }
  setMembers: (members) => set({ members }),

  // --- UI State ---
  selectedId: null,
  setSelectedId: (id) => set({ selectedId: id }),

  panelOpen: false,
  setPanelOpen: (open) => set({ panelOpen: open }),

  dragState: null,      // { dragId, overParentId, overPosition } | null
  setDragState: (s) => set({ dragState: s }),

  // --- Sync Status ---
  syncStatus: 'synced', // 'synced' | 'syncing'
  setSyncStatus: (s) => set({ syncStatus: s }),

  // --- Confirm Dialog ---
  confirm: null,        // { message, onOk } | null
  showConfirm: (message, onOk) => set({ confirm: { message, onOk } }),
  closeConfirm: () => set({ confirm: null }),

  // --- Undo Stack ---
  undoStack: [],        // [{ members }]
  pushUndo: () => {
    const { members, undoStack } = get()
    const snapshot = JSON.parse(JSON.stringify(members))
    const next = [snapshot, ...undoStack].slice(0, MAX_UNDO)
    set({ undoStack: next })
  },
  undo: async () => {
    const { undoStack, user, setSyncStatus } = get()
    if (!undoStack.length || !user) return

    const [prev, ...rest] = undoStack
    const current = get().members

    set({ undoStack: rest, members: prev })

    setSyncStatus('syncing')
    try {
      // 削除されたメンバーを復元、追加されたメンバーを削除、変更されたメンバーを更新
      const prevIds = new Set(Object.keys(prev))
      const curIds = new Set(Object.keys(current))

      const toAdd = [...prevIds].filter((id) => !curIds.has(id))
      const toDelete = [...curIds].filter((id) => !prevIds.has(id))
      const toUpdate = [...prevIds].filter((id) => curIds.has(id))

      await Promise.all([
        // 削除されていたメンバーを元のIDで復元
        ...toAdd.map((id) => {
          const { id: _id, ...data } = prev[id]
          return restoreMember(user.uid, id, data)
        }),
        // 新規追加されたメンバーを削除
        ...toDelete.map((id) => deleteMember(user.uid, id)),
        // 変更されたメンバーを更新
        ...toUpdate.map((id) => {
          const { id: _id, ...data } = prev[id]
          return updateMember(user.uid, id, data)
        }),
      ])
    } catch (e) {
      console.error('undo failed', e)
    } finally {
      setSyncStatus('synced')
    }
  },

  // --- Actions ---

  addNode: async (parentId, position) => {
    const { user, pushUndo, setSyncStatus } = get()
    if (!user) return

    pushUndo()
    setSyncStatus('syncing')

    const data = {
      name: '新メンバー',
      role: '',
      job: '',
      photo: null,
      parentId: parentId ?? null,
      position: position ?? null,
      collapsed: false,
    }

    try {
      const newId = await addMember(user.uid, data)
      set({ selectedId: newId, panelOpen: true })
    } catch (e) {
      console.error('addNode failed', e)
    } finally {
      setSyncStatus('synced')
    }
  },

  // ECM以上の下位表示／非表示トグル
  toggleCollapsed: async (memberId) => {
    const { user, members, setSyncStatus } = get()
    if (!user) return
    const cur = members[memberId]
    if (!cur) return
    const next = !cur.collapsed
    // 楽観的更新
    set((s) => ({
      members: { ...s.members, [memberId]: { ...s.members[memberId], collapsed: next } },
    }))
    setSyncStatus('syncing')
    try {
      await updateMember(user.uid, memberId, { collapsed: next })
    } catch (e) {
      console.error('toggleCollapsed failed', e)
      // ロールバック
      set((s) => ({
        members: { ...s.members, [memberId]: { ...s.members[memberId], collapsed: cur.collapsed } },
      }))
    } finally {
      setSyncStatus('synced')
    }
  },

  deleteNode: async (targetId) => {
    const { user, members, pushUndo, setSyncStatus, closeConfirm } = get()
    if (!user) return

    const descendants = collectDescendants(members, targetId)
    const allIds = [targetId, ...descendants]
    const count = descendants.length

    const memberName = members[targetId]?.name ?? ''

    get().showConfirm(
      `「${memberName}」と配下${count}人を削除します。よろしいですか？（元に戻すで復活可能）`,
      async () => {
        closeConfirm()
        pushUndo()
        setSyncStatus('syncing')
        try {
          await deleteMembers(user.uid, allIds)
          set((s) => {
            const next = { ...s.members }
            allIds.forEach((id) => delete next[id])
            return {
              members: next,
              selectedId: s.selectedId === targetId ? null : s.selectedId,
              panelOpen: s.selectedId === targetId ? false : s.panelOpen,
            }
          })
        } catch (e) {
          console.error('deleteNode failed', e)
        } finally {
          setSyncStatus('synced')
        }
      }
    )
  },

  saveNode: async (memberId, data) => {
    const { user, pushUndo, setSyncStatus } = get()
    if (!user) return

    pushUndo()
    setSyncStatus('syncing')
    try {
      await updateMember(user.uid, memberId, data)
      set((s) => ({
        members: {
          ...s.members,
          [memberId]: { ...s.members[memberId], ...data },
        },
      }))
    } catch (e) {
      console.error('saveNode failed', e)
    } finally {
      setSyncStatus('synced')
    }
  },

  moveNode: async (dragId, newParentId, newPosition) => {
    const { user, members, pushUndo, setSyncStatus, closeConfirm } = get()
    if (!user) return

    // ルートへの移動禁止
    if (newParentId === null) return

    // 循環参照チェック（自分の子孫には移動不可）
    const descendants = new Set(collectDescendants(members, dragId))
    if (descendants.has(newParentId)) return

    // 新しい親が既に左右両方埋まっているかチェック
    const siblings = Object.values(members).filter((m) => m.parentId === newParentId)
    const occupied = siblings.some((m) => m.id !== dragId && m.position === newPosition)
    if (occupied) return

    const dragName = members[dragId]?.name ?? ''
    const parentName = members[newParentId]?.name ?? ''
    const posLabel = newPosition === 'left' ? '左' : '右'
    const descCount = collectDescendants(members, dragId).length

    const subLabel = descCount > 0 ? `（配下${descCount}人と共に）` : ''

    get().showConfirm(
      `「${dragName}」${subLabel}を、「${parentName}」の${posLabel}に移動します。よろしいですか？`,
      async () => {
        closeConfirm()
        pushUndo()
        setSyncStatus('syncing')
        try {
          await updateMember(user.uid, dragId, {
            parentId: newParentId,
            position: newPosition,
          })
          set((s) => ({
            members: {
              ...s.members,
              [dragId]: { ...s.members[dragId], parentId: newParentId, position: newPosition },
            },
          }))
        } catch (e) {
          console.error('moveNode failed', e)
        } finally {
          setSyncStatus('synced')
        }
      }
    )
  },

  // ルートノードの追加（parentId=null）
  addRootNode: async () => {
    const { user, pushUndo, setSyncStatus } = get()
    if (!user) return

    pushUndo()
    setSyncStatus('syncing')
    try {
      const newId = await addMember(user.uid, {
        name: '新メンバー',
        role: '',
        job: '',
        photo: null,
        parentId: null,
        position: null,
        collapsed: false,
      })
      set({ selectedId: newId, panelOpen: true })
    } catch (e) {
      console.error('addRootNode failed', e)
    } finally {
      setSyncStatus('synced')
    }
  },
}))
