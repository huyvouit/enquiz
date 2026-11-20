import { ClassAnalyticsTab } from '@/features/analytics'
import { ClassAssignmentsTab } from '@/features/assignments'
import { ClassDetailPage } from '@/features/classes'

const TABS = { assignments: ClassAssignmentsTab, analytics: ClassAnalyticsTab }

/** The class page with the Bài tập and Thống kê tabs plugged in, so the features stay decoupled. */
export default function ClassWorkspacePage() {
  return <ClassDetailPage tabs={TABS} />
}
