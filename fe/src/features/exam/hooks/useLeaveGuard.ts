import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

export const LEAVE_MESSAGE =
  'Em đang làm bài kiểm tra. Bài đã được lưu, nhưng đồng hồ vẫn chạy. Em có muốn thoát không?'

/**
 * While `active`, warns before closing/reloading the tab (the browser shows
 * its own text) and asks before leaving through an in-app link.
 * Turn it off before navigating to the result.
 */
export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Older browsers need returnValue set.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [active])

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => active && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm(LEAVE_MESSAGE)) blocker.proceed()
    else blocker.reset()
  }, [blocker])
}
