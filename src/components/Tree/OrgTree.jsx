import { useState, useRef, useEffect, useMemo, useReducer } from 'react'
import { useStore } from '../../store/useStore.js'
import { useTreeLayout, NODE_W, collectDescendants, getSlotPos } from './useTreeLayout.js'
import TreeNode from './TreeNode.jsx'
import DropZone from './DropZone.jsx'

const MIN_SCALE = 0.15
const MAX_SCALE = 3
const DRAG_THRESHOLD = 6
const LONG_PRESS_MS = 500
const DROP_SNAP_DIST = NODE_W * 0.7

function isRootNode(member, members) {
  return !member.parentId || !members[member.parentId]
}

export default function OrgTree() {
  const members       = useStore((s) => s.members)
  const setSelectedId = useStore((s) => s.setSelectedId)
  const setPanelOpen  = useStore((s) => s.setPanelOpen)
  const addNode       = useStore((s) => s.addNode)
  const deleteNode    = useStore((s) => s.deleteNode)
  const moveNode      = useStore((s) => s.moveNode)
  const addRootNode   = useStore((s) => s.addRootNode)
  const undo          = useStore((s) => s.undo)

  const { positions, childMap } = useTreeLayout()
  const containerRef = useRef(null)
  const svgRef       = useRef(null)

  // Pan/zoom
  const [tfm, setTfm] = useState({ x: 80, y: 80, scale: 1 })
  const tfmRef = useRef(tfm)
  useEffect(() => { tfmRef.current = tfm }, [tfm])

  // Hover
  const [hoveredId, setHoveredId] = useState(null)
  const hoverTimer                 = useRef(null)

  // Mobile long press
  const [longPressId, setLongPressId] = useState(null)
  const longPressTimer                 = useRef(null)

  // Drag — ref + forceUpdate で stale closure を回避
  const dragRef = useRef(null)
  const [, forceUpdate] = useReducer((x) => x + 1, 0)
  function setDrag(valOrFn) {
    dragRef.current = typeof valOrFn === 'function' ? valOrFn(dragRef.current) : valOrFn
    forceUpdate()
  }

  // Click vs drag
  const pointerRef = useRef(null) // { id, startX, startY, moved }

  // 背景パン＆ピンチズーム用
  const bgPanRef      = useRef(null)
  const bgPointersRef = useRef(new Map()) // pointerId → { x, y }

  // ── キーボードショートカット ───────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() }
      if (e.key === 'Escape') { setDrag(null); setHoveredId(null); setLongPressId(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])

  // ── ホイールズーム（passive: false）────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e) => {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.92 : 1.09
      const rect = svgRef.current.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      setTfm((t) => {
        const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.scale * factor))
        const r = s / t.scale
        return { scale: s, x: cx - (cx - t.x) * r, y: cy - (cy - t.y) * r }
      })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // ── 初回データ読み込み時に全体表示 ────────────────────────
  const centeredRef = useRef(false)
  useEffect(() => {
    if (!centeredRef.current && Object.keys(positions).length && svgRef.current) {
      centeredRef.current = true
      fitView()
    }
  }, [positions]) // eslint-disable-line

  function fitView() {
    if (!svgRef.current || !Object.keys(positions).length) return
    const xs = Object.values(positions).map((p) => p.x)
    const ys = Object.values(positions).map((p) => p.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs) + NODE_W
    const minY = Math.min(...ys), maxY = Math.max(...ys) + 72
    const svgW = svgRef.current.clientWidth
    const svgH = svgRef.current.clientHeight
    const treeW = maxX - minX || 1
    const treeH = maxY - minY || 1
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE,
      Math.min((svgW - 120) / treeW, (svgH - 120) / treeH)
    ))
    setTfm({
      scale,
      x: (svgW - treeW * scale) / 2 - minX * scale,
      y: (svgH - treeH * scale) / 2 - minY * scale,
    })
  }

  // SVG座標変換
  function toSVG(cx, cy) {
    const t = tfmRef.current
    const rect = svgRef.current.getBoundingClientRect()
    return { x: (cx - rect.left - t.x) / t.scale, y: (cy - rect.top - t.y) / t.scale }
  }

  // ── ホバーヘルパー ─────────────────────────────────────────
  const clearHover   = () => clearTimeout(hoverTimer.current)
  const scheduleHide = () => { hoverTimer.current = setTimeout(() => setHoveredId(null), 400) }

  // ── ドロップゾーン計算 ────────────────────────────────────
  const draggedDescendants = useMemo(() => {
    const d = dragRef.current
    if (!d) return new Set()
    return new Set([d.id, ...collectDescendants(childMap, d.id)])
  }, [dragRef.current, childMap]) // eslint-disable-line

  const dropZones = useMemo(() => {
    const d = dragRef.current
    if (!d) return []
    const zones = []
    Object.keys(members).forEach((parentId) => {
      if (draggedDescendants.has(parentId)) return
      ;['left', 'right'].forEach((pos) => {
        const cm = childMap[parentId] || {}
        if (cm[pos]) return
        const slotPos = getSlotPos(positions, childMap, parentId, pos)
        if (!slotPos) return
        zones.push({ parentId, position: pos, x: slotPos.x, y: slotPos.y })
      })
    })
    return zones
  }, [dragRef.current, members, childMap, positions, draggedDescendants]) // eslint-disable-line

  const dropZonesRef = useRef([])
  dropZonesRef.current = dropZones

  function findOverZone(svgX, svgY) {
    const cx = svgX + NODE_W / 2, cy = svgY + 36
    let best = null, bestDist = DROP_SNAP_DIST
    dropZonesRef.current.forEach((z) => {
      const d = Math.hypot(cx - (z.x + NODE_W / 2), cy - (z.y + 36))
      if (d < bestDist) { bestDist = d; best = z }
    })
    return best
  }

  // ── 背景パン＆ピンチズーム（pointer events）─────────────
  function handleBgPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    bgPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (bgPointersRef.current.size === 1) {
      bgPanRef.current = {
        startX: e.clientX, startY: e.clientY,
        startTx: tfmRef.current.x, startTy: tfmRef.current.y,
      }
    }
  }

  function handleBgPointerMove(e) {
    const ptrs = bgPointersRef.current
    if (!ptrs.has(e.pointerId)) return

    if (ptrs.size === 1) {
      if (pointerRef.current?.moved) { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); return }
      const dx = e.clientX - bgPanRef.current.startX
      const dy = e.clientY - bgPanRef.current.startY
      setTfm((t) => ({ ...t, x: bgPanRef.current.startTx + dx, y: bgPanRef.current.startTy + dy }))
    } else if (ptrs.size === 2) {
      const entries = [...ptrs.entries()]
      const [id1, pos1] = entries[0]
      const [id2, pos2] = entries[1]
      const cur1 = id1 === e.pointerId ? { x: e.clientX, y: e.clientY } : pos1
      const cur2 = id2 === e.pointerId ? { x: e.clientX, y: e.clientY } : pos2
      const prevDist = Math.hypot(pos1.x - pos2.x, pos1.y - pos2.y)
      const curDist  = Math.hypot(cur1.x - cur2.x, cur1.y - cur2.y)
      const factor = curDist / (prevDist || 1)
      const rect = svgRef.current.getBoundingClientRect()
      const midX = (cur1.x + cur2.x) / 2 - rect.left
      const midY = (cur1.y + cur2.y) / 2 - rect.top
      setTfm((t) => {
        const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.scale * factor))
        const r = s / t.scale
        return { scale: s, x: midX - (midX - t.x) * r, y: midY - (midY - t.y) * r }
      })
    }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }

  function handleBgPointerUp(e) {
    bgPointersRef.current.delete(e.pointerId)
    if (bgPointersRef.current.size === 1) {
      const [remaining] = [...bgPointersRef.current.entries()]
      bgPanRef.current = {
        startX: remaining[1].x, startY: remaining[1].y,
        startTx: tfmRef.current.x, startTy: tfmRef.current.y,
      }
    } else if (bgPointersRef.current.size === 0) {
      bgPanRef.current = null
    }
  }

  // ── ノードポインターイベント ──────────────────────────────
  function handleNodePointerDown(e, id) {
    e.preventDefault()
    e.stopPropagation()
    setLongPressId(null)
    pointerRef.current = { id, startX: e.clientX, startY: e.clientY, moved: false }

    if (e.pointerType === 'touch') {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = setTimeout(() => {
        setLongPressId(id)
        if (navigator.vibrate) navigator.vibrate(50)
      }, LONG_PRESS_MS)
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handleNodePointerMove(e) {
    if (!pointerRef.current) return
    const dx = e.clientX - pointerRef.current.startX
    const dy = e.clientY - pointerRef.current.startY
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (!pointerRef.current.moved && dist > DRAG_THRESHOLD) {
      clearTimeout(longPressTimer.current)
      const id = pointerRef.current.id
      if (!isRootNode(members[id] ?? {}, members)) {
        pointerRef.current.moved = true
        const sv = toSVG(e.clientX, e.clientY)
        setDrag({ id, ghostX: sv.x - NODE_W / 2, ghostY: sv.y - 36, overParentId: null, overPosition: null })
        return
      }
    }

    if (pointerRef.current.moved && dragRef.current) {
      const sv = toSVG(e.clientX, e.clientY)
      const ghostX = sv.x - NODE_W / 2
      const ghostY = sv.y - 36
      const over = findOverZone(ghostX, ghostY)
      setDrag({ ...dragRef.current, ghostX, ghostY,
        overParentId: over?.parentId ?? null,
        overPosition: over?.position ?? null,
      })
    }
  }

  function handleNodePointerUp(e, id) {
    clearTimeout(longPressTimer.current)
    if (!pointerRef.current) return
    const wasDragging = pointerRef.current.moved
    pointerRef.current = null

    if (!wasDragging) {
      if (longPressId !== id) {
        setSelectedId(id)
        setPanelOpen(true)
        setLongPressId(null)
      }
    } else {
      const d = dragRef.current
      if (d?.overParentId && d?.overPosition) {
        moveNode(d.id, d.overParentId, d.overPosition)
      }
      setDrag(null)
    }
  }

  // ── ＋ / 🗑️ ボタン ────────────────────────────────────────
  function handleAddClick(e, parentId, position) {
    e.stopPropagation()
    clearHover(); setHoveredId(null); setLongPressId(null)
    addNode(parentId, position)
  }
  function handleDeleteClick(e, id) {
    e.stopPropagation()
    clearHover(); setHoveredId(null); setLongPressId(null)
    deleteNode(id)
  }

  // ── エッジ ────────────────────────────────────────────────
  const edges = useMemo(() => {
    const lines = []
    Object.values(members).forEach((m) => {
      if (!m.parentId || !positions[m.parentId] || !positions[m.id]) return
      const pp = positions[m.parentId], cp = positions[m.id]
      const x1 = pp.x + NODE_W / 2, y1 = pp.y + 72
      const x2 = cp.x + NODE_W / 2, y2 = cp.y
      const midY = (y1 + y2) / 2
      lines.push({ id: m.id, d: `M${x1},${y1} L${x1},${midY} L${x2},${midY} L${x2},${y2}` })
    })
    return lines
  }, [members, positions])

  const drag            = dragRef.current
  const activeControlId = hoveredId || longPressId
  const isEmpty         = Object.keys(members).length === 0

  // CSS transform 文字列（HTML overlay と SVG group で共通）
  const groupTransform = `translate(${tfm.x}px, ${tfm.y}px) scale(${tfm.scale})`
  const svgGroupTransform = `translate(${tfm.x},${tfm.y}) scale(${tfm.scale})`

  // ── レンダー ──────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%', position: 'relative',
        overflow: 'hidden', background: '#EBEBEB',
        userSelect: 'none', touchAction: 'none',
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* ツールバー（左下） */}
      <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 10 }}>
        <button
          onClick={addRootNode}
          style={{
            background: '#7C3AED', color: 'white', border: 'none', borderRadius: 8,
            padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
            boxShadow: '0 2px 6px rgba(124,58,237,0.35)',
          }}
        >
          ＋ ルート追加
        </button>
      </div>

      {/* 全体表示（右下） */}
      <button
        onClick={fitView}
        style={{
          position: 'absolute', bottom: 16, right: 16, zIndex: 10,
          background: 'white', border: '1px solid #D1D5DB', borderRadius: 8,
          padding: '6px 12px', fontSize: 13, color: '#374151', cursor: 'pointer',
          boxShadow: '0 1px 4px rgba(0,0,0,.12)',
        }}
      >
        ⊞ 全体表示
      </button>

      {/* メンバーゼロガイド */}
      {isEmpty && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 5,
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 48, opacity: 0.2 }}>🌳</div>
          <div style={{ fontSize: 15, color: '#9CA3AF', fontWeight: 500 }}>
            左下の「＋ ルート追加」からメンバーを追加
          </div>
        </div>
      )}

      {/* SVG — エッジ・ドロップゾーン・インタラクション overlay */}
      <svg
        ref={svgRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', touchAction: 'none', userSelect: 'none' }}
        onDragStart={(e) => e.preventDefault()}
      >
        {/* 背景（パン＆ピンチズームのヒットエリア） */}
        <rect
          width="100%" height="100%" fill="#EBEBEB"
          onPointerDown={handleBgPointerDown}
          onPointerMove={handleBgPointerMove}
          onPointerUp={handleBgPointerUp}
          onPointerCancel={handleBgPointerUp}
        />

        <g transform={svgGroupTransform}>
          {/* エッジ */}
          {edges.map((e) => (
            <path key={e.id} d={e.d} fill="none" stroke="#C4C4C4" strokeWidth={2} />
          ))}

          {/* ドロップゾーン */}
          {drag && dropZones.map((z) => {
            const isOver = z.parentId === drag.overParentId && z.position === drag.overPosition
            return (
              <DropZone key={`dz-${z.parentId}-${z.position}`}
                x={z.x} y={z.y} isOver={isOver} isValid={true} />
            )
          })}

          {/* オーバーレイ rect（ノードインタラクション） */}
          {Object.values(members).map((m) => {
            const pos = positions[m.id]
            if (!pos) return null
            const isRoot = isRootNode(m, members)
            return (
              <rect key={`r-${m.id}`}
                x={pos.x} y={pos.y} width={NODE_W} height={72} rx={10}
                fill="transparent" pointerEvents="all"
                style={{ cursor: isRoot ? 'default' : 'grab' }}
                onPointerEnter={() => { clearHover(); setHoveredId(m.id) }}
                onPointerLeave={scheduleHide}
                onPointerDown={(e) => handleNodePointerDown(e, m.id)}
                onPointerMove={handleNodePointerMove}
                onPointerUp={(e) => handleNodePointerUp(e, m.id)}
              />
            )
          })}

          {/* ホバー／長押しコントロール */}
          {activeControlId && positions[activeControlId] && !drag && (() => {
            const id  = activeControlId
            const pos = positions[id]
            const cm  = childMap[id] || {}
            return (
              <g
                onPointerEnter={clearHover}
                onPointerLeave={scheduleHide}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {!cm.left && (
                  <g style={{ cursor: 'pointer' }} onClick={(e) => handleAddClick(e, id, 'left')}>
                    <circle cx={pos.x + NODE_W * 0.28} cy={pos.y + 72 + 22} r={14}
                      fill="white" stroke="#10B981" strokeWidth={2} />
                    <text x={pos.x + NODE_W * 0.28} y={pos.y + 72 + 27}
                      textAnchor="middle" fontSize={20} fill="#10B981"
                      style={{ pointerEvents: 'none' }}>+</text>
                  </g>
                )}
                {!cm.right && (
                  <g style={{ cursor: 'pointer' }} onClick={(e) => handleAddClick(e, id, 'right')}>
                    <circle cx={pos.x + NODE_W * 0.72} cy={pos.y + 72 + 22} r={14}
                      fill="white" stroke="#10B981" strokeWidth={2} />
                    <text x={pos.x + NODE_W * 0.72} y={pos.y + 72 + 27}
                      textAnchor="middle" fontSize={20} fill="#10B981"
                      style={{ pointerEvents: 'none' }}>+</text>
                  </g>
                )}
                <g style={{ cursor: 'pointer' }} onClick={(e) => handleDeleteClick(e, id)}>
                  <circle cx={pos.x + NODE_W + 8} cy={pos.y - 8} r={13}
                    fill="white" stroke="#EF4444" strokeWidth={2} />
                  <text x={pos.x + NODE_W + 8} y={pos.y - 3}
                    textAnchor="middle" fontSize={13}
                    style={{ pointerEvents: 'none' }}>🗑️</text>
                </g>
              </g>
            )
          })()}
        </g>
      </svg>

      {/* HTML ノードオーバーレイ（foreignObject の代替 — iOS Safari 対応）*/}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0,
          transform: groupTransform,
          transformOrigin: '0 0',
        }}>
          {Object.values(members).map((m) => {
            const pos = positions[m.id]
            if (!pos) return null
            return (
              <div key={m.id} style={{ position: 'absolute', left: pos.x, top: pos.y, pointerEvents: 'none' }}>
                <TreeNode
                  member={m}
                  isRoot={isRootNode(m, members)}
                  isDragging={draggedDescendants.has(m.id) && !!drag}
                />
              </div>
            )
          })}

          {/* ドラッグゴースト */}
          {drag && (
            <div style={{ position: 'absolute', left: drag.ghostX, top: drag.ghostY, opacity: 0.75, pointerEvents: 'none' }}>
              <TreeNode member={members[drag.id]} isRoot={false} isDragging={false} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
