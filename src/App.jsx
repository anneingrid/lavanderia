import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider, useData } from './context/DataContext'
import { ToastProvider } from './context/ToastContext'
import { Layout } from './components/Layout'
import { PrecoGlobalModal } from './components/PrecoGlobalModal'
import { Login } from './pages/Login'
import { Pecas } from './pages/Pecas'
import { Pagamentos } from './pages/Pagamentos'
import { Mensal } from './pages/Mensal'
import { Relatorio } from './pages/Relatorio'
import { Clientes } from './pages/Clientes'
import { Tipos } from './pages/Tipos'

// ---------------------------------------------------------------------------
// Loading global (barra topo)
// ---------------------------------------------------------------------------
function LoadingBar() {
  const { loading } = useData()
  return loading ? (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 3,
      background: 'var(--terracotta)', zIndex: 9999,
      animation: 'pulse 1s ease infinite',
    }} />
  ) : null
}

// ---------------------------------------------------------------------------
// App autenticado: carrega dados e renderiza as abas
// ---------------------------------------------------------------------------
function AppAutenticado() {
  const { carregarTudo } = useData()
  const [tab,             setTab]             = useState('lancamento')
  const [precoModalOpen,  setPrecoModalOpen]  = useState(false)
  // Para navegação programática do relatório → mensal
  const [mesAlvo, setMesAlvo] = useState(null)

  useEffect(() => { carregarTudo() }, [carregarTudo])

  function irParaMes(ano, mes) {
    setMesAlvo({ ano, mes })
    setTab('mensal')
  }

  function handleTabChange(t) {
    setTab(t)
    if (t !== 'mensal') setMesAlvo(null)
  }

  const pages = {
    lancamento: <Pecas />,
    pagamento:  <Pagamentos />,
    mensal:     <Mensal mesAlvo={mesAlvo} />,
    relatorio:  <Relatorio onIrParaMes={irParaMes} />,
    clientes:   <Clientes />,
    tipos:      <Tipos />,
  }

  return (
    <>
      <LoadingBar />
      <Layout activeTab={tab} onTabChange={handleTabChange} onOpenPrecoGlobal={() => setPrecoModalOpen(true)}>
        {pages[tab]}
      </Layout>
      <PrecoGlobalModal open={precoModalOpen} onClose={() => setPrecoModalOpen(false)} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Raiz: decide entre Login e App
// ---------------------------------------------------------------------------
function Root() {
  const { session } = useAuth()

  // Ainda verificando sessão
  if (session === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ fontFamily: 'DM Sans, serif', fontSize: '1.4rem', color: 'var(--terracotta)' }}>
          lavanda<span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--ink-light)' }}>ria</span> 🧺
        </div>
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <DataProvider>
      <AppAutenticado />
    </DataProvider>
  )
}

// ---------------------------------------------------------------------------
// Export padrão: envolve tudo nos providers globais
// ---------------------------------------------------------------------------
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Root />
      </ToastProvider>
    </AuthProvider>
  )
}
