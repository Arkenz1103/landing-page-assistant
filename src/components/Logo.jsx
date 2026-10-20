// Landing Page Assistant mark: a four-point spark inside an open target ring, with a dot in the ring's gap.
// Drawn in currentColor, so `className` sets both its size and its color.
export default function Logo({ className = '', title }) {
  return (
    <svg
      className={`logo ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
    >
      {title && <title>{title}</title>}
      {/* open ring: ~80% of the circle, gap at the top right */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="50.3 12.5"
        transform="rotate(-30 12 12)"
      />
      <circle cx="19.6" cy="4.4" r="1.6" fill="currentColor" />
      {/* four-point spark */}
      <path
        d="M12 5.6C12.55 9.55 14.45 11.45 18.4 12C14.45 12.55 12.55 14.45 12 18.4C11.45 14.45 9.55 12.55 5.6 12C9.55 11.45 11.45 9.55 12 5.6Z"
        fill="currentColor"
      />
    </svg>
  );
}
