import { useEffect } from 'react'
import { useStore } from './store/useStore.js'
import { useSync } from './store/useSync.js'
import LoginPage from './components/Auth/LoginPage.jsx'
import OrgTree from './components/Tree/OrgTree.jsx'
import DetailPanel from './components/Panel/DetailPanel.jsx'
import ConfirmDialog from './components/UI/ConfirmDialog.jsx'
import SyncStatus from './components/UI/SyncStatus.jsx'

export default function App() {
  const user = useStore((s) => s.user)
  const confirm = useStore((s) => s.confirm)

  useSync()

  if (!user) return <LoginPage />

  return (
    <div className="relative w-full h-full">
      <OrgTree />
      <DetailPanel />
      <SyncStatus />
      {confirm && <ConfirmDialog />}
    </div>
  )
}
