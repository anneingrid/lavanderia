import {
  ClipboardList, Banknote, CalendarDays, BarChart2,
  Users, Tag, Settings2, LogOut, WashingMachine,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const TABS = [
  { id: 'lancamento', label: 'Peças',      icon: ClipboardList },
  { id: 'pagamento',  label: 'Pagamentos', icon: Banknote      },
  { id: 'mensal',     label: 'Mensal',     icon: CalendarDays  },
  { id: 'relatorio',  label: 'Relatório',  icon: BarChart2     },
  { id: 'clientes',   label: 'Clientes',   icon: Users         },
  { id: 'tipos',      label: 'Tipos',      icon: Tag           },
]

const styles = `
  nav .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    font-size: 0.68rem;
    padding: 8px 6px 6px;
    line-height: 1;
  }

  nav .tab span {
    display: block;
  }

  .btn-config {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .btn-config-logout:hover {
    color: var(--red, #dc3545);
    background: rgba(220, 53, 69, 0.07);
  }

  @media (max-width: 360px) {
    .btn-config span { display: none; }
  }
`

export function Layout({ activeTab, onTabChange, onOpenPrecoGlobal, children }) {
  const { logout } = useAuth()

  return (
    <>
      <style>{styles}</style>

      <div className="app">
        <header>
          <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <WashingMachine size={22} strokeWidth={1.8} style={{ color: 'var(--sage, #6b9e7a)' }} />
            lavande<span>ria</span>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
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