import { useMemo } from 'react'
import { useStore } from '../../store/useStore.js'

export const NODE_W = 200
export const NODE_H = 72
export const GAP_X = 14
export const GAP_Y = 54

export function useTreeLayout() {
  const members = useStore((s) => s.members)
  return useMemo(() => computeLayout(members), [members])
}

export function computeLayout(members) {
  const ids = Object.keys(members)
  if (!ids.length) return { positions: {}, childMap: {}, roots: [], hiddenChildrenMap: {} }

  // Build child map: { [id]: { left: id|null, right: id|null } }
  const childMap = {}
  ids.forEach((id) => { childMap[id] = { left: null, right: null } })

  const roots = []
  ids.forEach((id) => {
    const m = members[id]
    if (!m.parentId || !members[m.parentId]) {
      roots.push(id)
    } else {
      childMap[m.parentId][m.position] = id
    }
  })

  // 折りたたまれたノードの配下を非表示にする
  // - visibleIds: 表示対象のノードID集合
  // - hiddenChildrenMap: 折りたたみ中で非表示の子を持つノード { [id]: count }
  const visibleIds = new Set()
  const hiddenChildrenMap = {}
  const queue = [...roots]
  while (queue.length) {
    const id = queue.shift()
    visibleIds.add(id)
    const m = members[id]
    const { left, right } = childMap[id] || {}
    const childCount = (left ? 1 : 0) + (right ? 1 : 0)
    if (m?.collapsed && childCount > 0) {
      // 配下は非表示。配下の総数を集計
      const allDesc = collectDescendants(childMap, id)
      hiddenChildrenMap[id] = allDesc.length
    } else {
      if (left) queue.push(left)
      if (right) queue.push(right)
    }
  }

  // 非表示ノードは childMap から外す（レイアウト計算で扱わない）
  Object.keys(childMap).forEach((id) => {
    if (!visibleIds.has(id)) {
      delete childMap[id]
    } else {
      const cm = childMap[id]
      if (cm.left && !visibleIds.has(cm.left))   cm.left  = null
      if (cm.right && !visibleIds.has(cm.right)) cm.right = null
    }
  })

  // Post-order: assign leaf counters, then center parents over children
  const cols = {}
  const depths = {}
  let leafCounter = 0

  function process(id, depth) {
    depths[id] = depth
    const { left, right } = childMap[id]

    if (!left && !right) {
      cols[id] = leafCounter++
      return
    }

    let lCol, rCol
    if (left) {
      process(left, depth + 1)
      lCol = cols[left]
    } else {
      lCol = leafCounter++  // phantom left slot
    }
    if (right) {
      process(right, depth + 1)
      rCol = cols[right]
    } else {
      rCol = leafCounter++  // phantom right slot
    }
    cols[id] = (lCol + rCol) / 2
  }

  roots.forEach((rootId, i) => {
    process(rootId, 0)
    if (i < roots.length - 1) leafCounter++ // extra gap between separate trees
  })

  // Convert to pixel positions
  const positions = {}
  ids.forEach((id) => {
    if (cols[id] != null && visibleIds.has(id)) {
      positions[id] = {
        x: cols[id] * (NODE_W + GAP_X),
        y: depths[id] * (NODE_H + GAP_Y),
      }
    }
  })

  return { positions, childMap, roots, hiddenChildrenMap }
}

// Collect all descendant IDs of a given node
export function collectDescendants(childMap, rootId) {
  const result = []
  const queue = [rootId]
  while (queue.length) {
    const id = queue.shift()
    const { left, right } = childMap[id] || {}
    if (left) { result.push(left); queue.push(left) }
    if (right) { result.push(right); queue.push(right) }
  }
  return result
}

// Compute drop zone position for an empty slot
export function getSlotPos(positions, childMap, parentId, position) {
  const pPos = positions[parentId]
  if (!pPos) return null

  const { left, right } = childMap[parentId] || {}
  const y = pPos.y + NODE_H + GAP_Y

  let x
  if (position === 'left') {
    if (right && positions[right]) {
      x = 2 * pPos.x - positions[right].x
    } else {
      x = pPos.x - NODE_W / 2 - GAP_X   // 子なし: 親の中心から半ノード幅+gap左
    }
  } else {
    if (left && positions[left]) {
      x = 2 * pPos.x - positions[left].x
    } else {
      x = pPos.x + NODE_W / 2 + GAP_X   // 子なし: 親の中心から半ノード幅+gap右
    }
  }

  return { x, y }
}
