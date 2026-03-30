export function Empty({ emoji = '📭', message, children }) {
  return (
    <div className="empty">
      <span className="emoji">{emoji}</span>
      {message && <p>{message}</p>}
      {children}
    </div>
  )
}
