export const ROLES = {
  PDCM: {
    label: 'PDCM',
    fill: '#E9DBFB',
    border: '#8B5CF6',
    text: '#4C1D95',
    sub: '#7C3AED',
  },
  DCM: {
    label: 'DCM',
    fill: '#DBEAFE',
    border: '#3B82F6',
    text: '#1E3A8A',
    sub: '#2563EB',
  },
  ECM: {
    label: 'ECM',
    fill: '#A7F3D0',
    border: '#10B981',
    text: '#064E3B',
    sub: '#059669',
  },
  PM: {
    label: 'PM',
    fill: '#E2E8F0',
    border: '#64748B',
    text: '#1E293B',
    sub: '#475569',
  },
  GM: {
    label: 'GM',
    fill: '#FDE68A',
    border: '#D97706',
    text: '#78350F',
    sub: '#B45309',
  },
  '': {
    label: '（なし）',
    fill: '#FFFFFF',
    border: '#D4D4D4',
    text: '#1F1F1F',
    sub: '#6B6B6B',
  },
}

export const ROLE_OPTIONS = ['', 'PDCM', 'DCM', 'ECM', 'PM', 'GM']

export const getRoleStyle = (role) => ROLES[role] ?? ROLES['']
