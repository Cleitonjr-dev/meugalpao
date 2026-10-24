interface LogoProps {
  className?: string
}

export function Logo({ className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 500"
      className={className}
      aria-hidden="true"
    >
      <polygon points="250,140 80,210 80,360 250,360" fill="#32a7d8" />
      <polygon points="250,140 420,210 420,360 408,360 408,219.1 250,154" fill="#32a7d8" />
      <polygon
        points="280,226.4 380,267.5 380,360 280,360"
        className="fill-[#262626] dark:fill-[#d9effa]"
      />
    </svg>
  )
}
