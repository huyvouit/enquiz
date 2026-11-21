import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { GuestOnly, LoginPage, RegisterPage, RequireAuth } from '@/features/auth'
import { MyAssignmentsPage } from '@/features/assignments'
import { PlayPage } from '@/features/play'
import { AttemptPage, HistoryPage, LeaderboardPage } from '@/features/progress'
import { StudentHomePage } from '@/features/quizzes/pages/StudentHomePage'
import type { Role } from '@/shared/api/types'
import { EmptyState, Spinner } from '@/shared/components'
import { AppLayout } from './AppLayout'
import { RootRedirect } from './RootRedirect'

/**
 * Teacher/admin screens are loaded on demand so the student bundle stays
 * small (phase 3). Exception to the "import a feature only through its
 * index.ts" rule: the router imports page files directly, otherwise the
 * whole feature would land in the main bundle. `pick` turns a named export
 * into a lazy default.
 */
function lazyPage<M>(load: () => Promise<M>, pick: (m: M) => ComponentType) {
  return lazy(() => load().then((m) => ({ default: pick(m) })))
}

const QuestionBankPage = lazyPage(() => import('@/features/questions/pages/QuestionBankPage'), (m) => m.QuestionBankPage)
const QuestionEditorPage = lazyPage(() => import('@/features/questions/pages/QuestionEditorPage'), (m) => m.QuestionEditorPage)
const QuestionImportPage = lazyPage(() => import('@/features/questions/pages/QuestionImportPage'), (m) => m.QuestionImportPage)
const TeacherDashboardPage = lazyPage(() => import('@/features/quizzes/pages/TeacherDashboardPage'), (m) => m.TeacherDashboardPage)
const QuizBuilderPage = lazyPage(() => import('@/features/quizzes/pages/QuizBuilderPage'), (m) => m.QuizBuilderPage)
const QuizResultsPage = lazyPage(() => import('@/features/progress/pages/QuizResultsPage'), (m) => m.QuizResultsPage)
const ClassesPage = lazyPage(() => import('@/features/classes/pages/ClassesPage'), (m) => m.ClassesPage)
const AssignmentReportPage = lazyPage(() => import('@/features/analytics/pages/AssignmentReportPage'), (m) => m.AssignmentReportPage)
const StudentReportPage = lazyPage(() => import('@/features/analytics/pages/StudentReportPage'), (m) => m.StudentReportPage)
const AdminUsersPage = lazyPage(() => import('@/features/admin/pages/AdminUsersPage'), (m) => m.AdminUsersPage)
const MapOrderPage = lazyPage(() => import('@/features/admin/pages/MapOrderPage'), (m) => m.MapOrderPage)

const ClassWorkspacePage = lazyPage(() => import('./ClassWorkspacePage'), (m) => m.default)
// Student page, but loaded on demand: only exam homework needs it.
const ExamPage = lazyPage(() => import('@/features/exam/pages/ExamPage'), (m) => m.ExamPage)
// Live quiz (plan 5): one chunk per screen, loaded only when used.
const LiveJoinPage = lazyPage(() => import('@/features/live/pages/LiveJoinPage'), (m) => m.LiveJoinPage)
const LivePlayPage = lazyPage(() => import('@/features/live/pages/LivePlayPage'), (m) => m.LivePlayPage)
const LiveSetupPage = lazyPage(() => import('@/features/live/pages/LiveSetupPage'), (m) => m.LiveSetupPage)
const LiveHostPage = lazyPage(() => import('@/features/live/pages/LiveHostPage'), (m) => m.LiveHostPage)
const LiveHistoryPage = lazyPage(() => import('@/features/live/pages/LiveHistoryPage'), (m) => m.LiveHistoryPage)
const LiveReportPage = lazyPage(() => import('@/features/live/pages/LiveReportPage'), (m) => m.LiveReportPage)

const staff: Role[] = ['teacher', 'admin']

function guarded(roles: Role[], page: ReactNode) {
  return (
    <RequireAuth roles={roles}>
      <Suspense fallback={<Spinner />}>{page}</Suspense>
    </RequireAuth>
  )
}

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: <GuestOnly><LoginPage /></GuestOnly> },
  { path: '/register', element: <GuestOnly><RegisterPage /></GuestOnly> },
  // Exam room (plan 4.2): full screen, outside AppLayout.
  { path: '/exam/:assignmentId', element: guarded(['student'], <ExamPage />) },
  // Live quiz (plan 5): public join + play (guests have no account),
  // and the full-screen projector, all outside AppLayout.
  { path: '/live', element: <Suspense fallback={<Spinner />}><LiveJoinPage /></Suspense> },
  { path: '/live/play', element: <Suspense fallback={<Spinner />}><LivePlayPage /></Suspense> },
  { path: '/teacher/live/:matchId/host', element: guarded(staff, <LiveHostPage />) },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      // Student
      { path: '/home', element: guarded(['student'], <StudentHomePage />) },
      { path: '/assignments', element: guarded(['student'], <MyAssignmentsPage />) },
      { path: '/history', element: guarded(['student'], <HistoryPage />) },
      // Any role
      { path: '/leaderboard', element: <LeaderboardPage /> },
      // Any role (teachers use /play as a preview)
      { path: '/play/:quizId', element: <PlayPage /> },
      { path: '/attempts/:attemptId', element: <AttemptPage /> },
      // Teacher / admin
      { path: '/teacher', element: guarded(staff, <TeacherDashboardPage />) },
      { path: '/teacher/classes', element: guarded(staff, <ClassesPage />) },
      { path: '/teacher/classes/:classId', element: guarded(staff, <ClassWorkspacePage />) },
      { path: '/teacher/classes/:classId/students/:studentId', element: guarded(staff, <StudentReportPage />) },
      { path: '/teacher/assignments/:assignmentId', element: guarded(staff, <AssignmentReportPage />) },
      { path: '/teacher/questions', element: guarded(staff, <QuestionBankPage />) },
      { path: '/teacher/questions/new', element: guarded(staff, <QuestionEditorPage />) },
      { path: '/teacher/questions/import', element: guarded(staff, <QuestionImportPage />) },
      { path: '/teacher/live', element: guarded(staff, <LiveHistoryPage />) },
      { path: '/teacher/live/new', element: guarded(staff, <LiveSetupPage />) },
      { path: '/teacher/live/:matchId', element: guarded(staff, <LiveReportPage />) },
      { path: '/teacher/questions/:id/edit', element: guarded(staff, <QuestionEditorPage />) },
      { path: '/teacher/quizzes/new', element: guarded(staff, <QuizBuilderPage />) },
      { path: '/teacher/quizzes/:id/edit', element: guarded(staff, <QuizBuilderPage />) },
      { path: '/teacher/quizzes/:quizId/results', element: guarded(staff, <QuizResultsPage />) },
      // Admin
      { path: '/admin/users', element: guarded(['admin'], <AdminUsersPage />) },
      { path: '/admin/map', element: guarded(['admin'], <MapOrderPage />) },
      { path: '*', element: <EmptyState emoji="🧭" title="Không tìm thấy trang này" /> },
    ],
  },
])
