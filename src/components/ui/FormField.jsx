export function FormField({ label, children, style }) {
  return (
    <div className="form-group" style={style}>
      {label && <label>{label}</label>}
      {children}
    </div>
  )
}
