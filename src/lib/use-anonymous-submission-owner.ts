'use client'

import { useSyncExternalStore } from 'react'
import { anonymousSubmissionOwnerKey } from '@/lib/maker-anonymous-owner'

const subscribeToStorage = (onStoreChange: () => void) => {
  window.addEventListener('storage', onStoreChange)
  return () => window.removeEventListener('storage', onStoreChange)
}

export function useAnonymousSubmissionOwnerToken(slug: string, submissionId: string, anonymousOwner: boolean) {
  return useSyncExternalStore(
    subscribeToStorage,
    () => anonymousOwner ? localStorage.getItem(anonymousSubmissionOwnerKey(slug, submissionId)) : '',
    () => anonymousOwner ? null : '',
  )
}
