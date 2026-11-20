import { useNavigate, useParams } from 'react-router-dom'
import { Card, ErrorBox, PageHeader, Spinner } from '@/shared/components'
import { useAsync } from '@/shared/hooks/useAsync'
import { questionsApi } from '../api/questions.api'
import { QuestionForm } from '../components/QuestionForm'

/** /teacher/questions/new and /teacher/questions/:id/edit */
export function QuestionEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useAsync(() => (id ? questionsApi.get(id) : Promise.resolve(undefined)), [id])
  const back = () => navigate('/teacher/questions')

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={id ? '✏️ Sửa câu hỏi' : '✨ Câu hỏi mới'} />
      <Card>
        {existing.loading ? <Spinner /> : null}
        {existing.error ? <ErrorBox message={existing.error} onRetry={existing.reload} /> : null}
        {!existing.loading && !existing.error ? (
          <QuestionForm question={existing.data} onSaved={back} onCancel={back} />
        ) : null}
      </Card>
    </div>
  )
}
