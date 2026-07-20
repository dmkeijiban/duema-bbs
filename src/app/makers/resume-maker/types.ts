import type { ResumeData } from '@/lib/maker-resume'

export type ResumeDraft = {
  data: ResumeData
  isPublic: boolean
}

export type ResumeProfileDefaults = {
  displayName: string
  avatarUrl: string | null
}

export type ResumeInitialState = {
  submissionId: string | null
  data: ResumeData | null
  isPublic: boolean
  profileDefaults: ResumeProfileDefaults | null
  profileSlug: string | null
  loggedIn: boolean
}
