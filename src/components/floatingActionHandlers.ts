const SCROLL_FOCUS_DELAY_MS = 350
const DESKTOP_FORM_TOP_OFFSET_PX = 64

function scrollToElementAndFocus(scrollTargetId: string, focusTargetId: string) {
  const scrollTarget = document.getElementById(scrollTargetId)
  if (!scrollTarget) return false

  scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
  window.setTimeout(() => {
    const focusTarget = document.getElementById(focusTargetId)
    if (focusTarget instanceof HTMLElement) {
      focusTarget.focus({ preventScroll: true })
    }
  }, SCROLL_FOCUS_DELAY_MS)

  return true
}

function scrollToElementAndFocusWithOffset(scrollTargetId: string, focusTargetId: string) {
  const scrollTarget = document.getElementById(scrollTargetId)
  if (!scrollTarget) return false

  const top = scrollTarget.getBoundingClientRect().top + window.scrollY - DESKTOP_FORM_TOP_OFFSET_PX
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  window.setTimeout(() => {
    const focusTarget = document.getElementById(focusTargetId)
    if (focusTarget instanceof HTMLElement) {
      focusTarget.focus({ preventScroll: true })
    }
  }, SCROLL_FOCUS_DELAY_MS)

  return true
}

export function scrollToPageTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

export function reloadCurrentPage() {
  window.location.reload()
}

export function moveToCommentForm() {
  scrollToElementAndFocus('reply-form-bottom', 'reply-textarea')
}

export function moveToNewThreadForm() {
  if (scrollToElementAndFocus('new-thread-title', 'new-thread-title')) return
  window.location.assign('/thread/new')
}

export function moveToHomeNewThreadForm() {
  if (scrollToElementAndFocus('resform', 'new-thread-title')) return
  window.location.assign('/thread/new')
}

export function moveToDesktopCommentForm() {
  scrollToElementAndFocusWithOffset('reply-form-bottom', 'reply-textarea')
}

export function moveToDesktopNewThreadForm() {
  if (scrollToElementAndFocusWithOffset('resform', 'new-thread-title')) return
  if (scrollToElementAndFocusWithOffset('new-thread-title', 'new-thread-title')) return
  window.location.assign('/thread/new')
}
