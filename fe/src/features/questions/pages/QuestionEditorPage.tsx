import { useNavigate, useParams } from 'react-router-dom'
import { errorMessage } from '@/shared/api/http'
import { Card, ErrorBox, PageHeader, Spinner } from '@/shared/components'
import { QuestionForm } from '../components/QuestionForm'
import { useQuestion } from '../hooks/queries'

/** /teacher/questions/new and /teacher/questions/:id/edit */
export function QuestionEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useQuestion(id)
  const back = () => navigate('/teacher/questions')

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={id ? '✏️ Sửa câu hỏi' : '✨ Câu hỏi mới'} />
      <Card>
        {existing.isLoading ? <Spinner /> : null}
        {existing.error ? (
          <ErrorBox message={errorMessage(existing.error)} onRetry={() => void existing.refetch()} />
        ) : null}
        {!existing.isLoading && !existing.error ? (
          <QuestionForm question={existing.data} onSaved={back} onCancel={back} />
        ) : null}
      </Card>
    </div>
  )
}
