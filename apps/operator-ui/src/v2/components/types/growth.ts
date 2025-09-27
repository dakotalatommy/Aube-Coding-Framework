export interface GrowthLesson {
  id: string
  title: string
  category: string
  description: string
  durationMinutes?: number
  releaseTs?: number
  featured?: boolean
  views?: number
  rating?: number
  lessonCount?: number
  resourceUrl?: string
  locked?: boolean
}

export interface GrowthCategory {
  id: string
  title: string
  description?: string
  iconName?: string
  colorClass?: string
}

export interface TutorialItem {
  id: string
  title: string
  description: string
  videoUrl?: string
  thumbnailUrl?: string
  durationMinutes?: number
  tags?: string[]
  locked?: boolean
}

export interface GrowthResponse {
  categories?: GrowthCategory[]
  lessons?: GrowthLesson[]
  tutorials?: TutorialItem[]
  featured?: GrowthLesson[]
  nextReleaseTs?: number | null
}
