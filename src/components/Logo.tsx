export function Logo({ className = 'size-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0D9488" />
      <path
        d="M32 12c7 5 10 13 10 21l5 6v6l-8-3h-14l-8 3v-6l5-6c0-8 3-16 10-21z"
        fill="#FAFAFA"
      />
      <circle cx="32" cy="28" r="4" fill="#0D9488" />
      <path d="M28 46h8l-4 8z" fill="#10B981" />
    </svg>
  )
}
