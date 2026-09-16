import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro,  setErro]  = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setErro(''); setLoading(true)
    try {
      await login(email, senha)
    } catch (err) {
      setErro('❌ ' + err.message)
    } finally { setLoading(false) }
  }

  return (
    <div id="login-screen" style={{ display: 'flex' }}>
      <div className="login-box">
        <div className="login-logo">Lavanderia<span> 9 </span> Pérolas 🧺</div>
        <div className="login-sub">Entre para acessar o sistema</div>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>E-mail</label>
            <input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input type="password" placeholder="••••••••" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          {erro && <div className="login-erro">{erro}</div>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
