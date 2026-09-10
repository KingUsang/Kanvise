import type { AvatarConfig } from '@/components/avatar/AvatarBuilder'

export function accountDashboardPath(role?: string) {
  return role === 'admin' || role === 'tutor' ? '/dashboard' : '/dashboard/student'
}

export function optionalProfileChanged(bio: string, savedBio: string, avatar: AvatarConfig, savedAvatar: AvatarConfig) {
  return bio !== savedBio || JSON.stringify(avatar) !== JSON.stringify(savedAvatar)
}
