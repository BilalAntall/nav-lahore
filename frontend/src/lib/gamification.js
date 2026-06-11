export const XP_REWARDS = {
  verifiedAlert: 20,
  stationCheckIn: 35,
}

export const LEVELS = [
  { title: 'Novice Rider', minXp: 0 },
  { title: 'Route Explorer', minXp: 100 },
  { title: 'City Commuter', minXp: 250 },
  { title: 'Transit Captain', minXp: 500 },
  { title: 'Lahore Legend', minXp: 900 },
]

const LEVEL_BADGES = LEVELS.map((level) => ({
  id: level.title.toLowerCase().replaceAll(' ', '-'),
  name: level.title,
  description:
    level.minXp === 0
      ? 'Start your NavLahore journey.'
      : `Reach ${level.minXp} XP to unlock this rider level.`,
  isUnlocked: (stats) => stats.xp >= level.minXp,
}))

export const BADGES = [
  ...LEVEL_BADGES,
  {
    id: 'station-scout',
    name: 'Station Scout',
    description: 'Check in at your first station with GPS.',
    isUnlocked: (stats) => stats.checkIns >= 1,
  },
  {
    id: 'alert-helper',
    name: 'Alert Helper',
    description: 'Post your first GPS-verified community alert.',
    isUnlocked: (stats) => stats.verifiedAlerts >= 1,
  },
  {
    id: 'metro-king',
    name: 'Metro King',
    description: 'Complete 5 verified station check-ins.',
    isUnlocked: (stats) => stats.checkIns >= 5,
  },
  {
    id: 'eco-warrior',
    name: 'Eco Warrior',
    description: 'Save at least 5 kg of CO2.',
    isUnlocked: (stats) => stats.co2SavedKg >= 5,
  },
  {
    id: 'early-bird',
    name: 'Early Bird',
    description: 'Check in before 8 AM.',
    isUnlocked: (stats) => stats.earlyCheckIns >= 1,
  },
  {
    id: 'city-champion',
    name: 'City Champion',
    description: 'Complete 10 verified station check-ins.',
    isUnlocked: (stats) => stats.checkIns >= 10,
  },
]

export function getCurrentLevel(xp = 0) {
  return [...LEVELS].reverse().find((level) => xp >= level.minXp) ?? LEVELS[0]
}

export function getNextLevel(xp = 0) {
  return LEVELS.find((level) => xp < level.minXp) ?? null
}

export function getBadgeProgress(stats) {
  return BADGES.map((badge) => ({
    ...badge,
    unlocked: badge.isUnlocked(stats),
  }))
}

export function getPrimaryBadge(stats) {
  return getCurrentLevel(stats.xp)
}
