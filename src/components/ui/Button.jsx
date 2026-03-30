export function Button({ children, variant = 'primary', size = 'md', onClick, disabled, type = 'button', style }) {
  const variants = {
    primary: 'btn btn-primary',
    success: 'btn btn-success',
    ghost:   'btn btn-ghost',
  }
  const sizes = { md: '', sm: 'btn-sm' }
  return (
    <button
      type={type}
      className={`${variants[variant]} ${sizes[size]}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  )
}
