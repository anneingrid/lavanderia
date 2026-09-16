import {
  ClipboardList, Banknote, CalendarDays, BarChart2,
  Users, Tag, Settings2, LogOut, WashingMachine,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const TABS = [
  { id: 'lancamento', label: 'Peças', icon: ClipboardList },
  { id: 'pagamento', label: 'Pagamentos', icon: Banknote },
  { id: 'mensal', label: 'Mensal', icon: CalendarDays },
  { id: 'relatorio', label: 'Relatório', icon: BarChart2 },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'tipos', label: 'Tipos', icon: Tag },
]

const styles = `
nav .tab {
  appearance: none;
  -webkit-appearance: none;
  outline: none;
  box-shadow: none;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;

  background: transparent;
  border: none;
  border-bottom: 2.5px solid transparent;

  font-family: 'DM Sans', sans-serif;
  font-size: 0.68rem;
  font-weight: 400;
  color: var(--ink-light);

  cursor: pointer;
  padding: 8px 6px 6px;
  line-height: 1;
  white-space: nowrap;

  transition: color 0.2s, border-color 0.2s, background 0.2s;
}

nav .tab:hover {
  color: var(--terracotta);
  background: transparent;
}

nav .tab:focus {
  outline: none;
  box-shadow: none;
}

nav .tab:focus-visible {
  outline: none;
  box-shadow: none;
}

nav .tab.active {
  color: var(--terracotta);
  border-bottom-color: var(--terracotta);
  font-weight: 500;
}

nav .tab span {
  display: block;
}

@media (max-width: 600px) {
  nav {
    padding: 0 12px;
    gap: 2px;
  }

  nav .tab {
    padding: 9px 10px 7px;
    font-size: 0.65rem;
    flex-shrink: 0;
  }
}

@media (max-width: 430px) {
  nav {
    padding: 0 8px;
  }

  nav .tab {
    padding-left: 8px;
    padding-right: 8px;
  }
}

@media (max-width: 360px) {
  nav .tab {
    padding-left: 7px;
    padding-right: 7px;
    font-size: 0.62rem;
  }
}
`

export function Layout({ activeTab, onTabChange, onOpenPrecoGlobal, children }) {
  const { logout } = useAuth()

  return (
    <>
      <style>{styles}</style>

      <div className="app">
        <header>
          <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <WashingMachine size={22} strokeWidth={1.8} style={{ color: 'var(--sage, #0e2e33)' }} />
            <span>9</span> Pérolas
          </div>

          <div style={{ display: 'flex', gap: 3 }}>
            <button
              className="btn-config"
              onClick={onOpenPrecoGlobal}
              title="Preço geral"
            >
              <Settings2 size={15} strokeWidth={2} />
              <span>Preço geral</span>
            </button>

            <button
              className="btn-config btn-config-logout"
              onClick={logout}
              title="Sair"
            >
              <LogOut size={15} strokeWidth={2} />
              <span>Sair</span>
            </button>
          </div>
        </header>

        <nav>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`tab${activeTab === id ? ' active' : ''}`}
              onClick={() => onTabChange(id)}
            >
              <Icon size={16} strokeWidth={activeTab === id ? 2.2 : 1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <main>{children}</main>
      </div>
    </>
  )
}