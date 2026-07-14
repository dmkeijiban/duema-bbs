export const ANONYMOUS_SUBMISSION_OWNER_PREFIX = 'maker-submission-owner'

export function anonymousSubmissionOwnerKey(slug: string, submissionId: string) {
  return `${ANONYMOUS_SUBMISSION_OWNER_PREFIX}:${slug}:${submissionId}`
}
