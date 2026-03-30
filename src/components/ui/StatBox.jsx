export function StatBox({ label, value, sub, color }) {
  return (
    <div className="stat-box">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function StatsGrid({ children }) {
  return <div className="stats">{children}</div>
}
