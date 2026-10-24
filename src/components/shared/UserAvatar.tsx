interface UserAvatarProps {
  name: string
  avatar?: string | null
  size?: number
}

export function UserAvatar({ name, avatar, size = 32 }: UserAvatarProps) {
  const iniciais = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('')

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <span
      className="flex items-center justify-center rounded-full bg-primary-600 font-semibold text-white"
      style={{ width: size, height: size, fontSize: Math.max(size * 0.4, 10) }}
    >
      {iniciais}
    </span>
  )
}
