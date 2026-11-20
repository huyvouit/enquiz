import { createPortal } from 'react-dom'
import type { CreatedStudent } from '../types'

const PRINT_ROOT_ID = 'enquiz-login-cards'

/**
 * Print-only sheet of login cards (A4, 2 x 4 = 8 cards per page).
 * Rendered into <body> next to the app; while printing, everything else in
 * <body> is hidden, on screen this sheet is hidden. Call window.print().
 */
export function LoginCardsPrint({ className, students }: { className: string; students: CreatedStudent[] }) {
  const loginUrl = `${window.location.origin}/login`
  return createPortal(
    <div id={PRINT_ROOT_ID}>
      <style>{`
        #${PRINT_ROOT_ID} { display: none; }
        @media print {
          @page { size: A4; margin: 10mm; }
          body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
          body { background: #fff !important; }
          #${PRINT_ROOT_ID} {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-auto-rows: 66mm;
            gap: 4mm;
            font-family: 'Nunito', sans-serif;
            color: #1f2937;
          }
          #${PRINT_ROOT_ID} .card {
            border: 1.5px dashed #94a3b8;
            border-radius: 6mm;
            padding: 5mm 6mm;
            break-inside: avoid;
            display: flex;
            flex-direction: column;
            gap: 1.5mm;
          }
          #${PRINT_ROOT_ID} .card:nth-child(8n) { break-after: page; }
          #${PRINT_ROOT_ID} .brand { font-weight: 800; font-size: 13pt; color: #4f46e5; }
          #${PRINT_ROOT_ID} .name { font-weight: 800; font-size: 15pt; }
          #${PRINT_ROOT_ID} .label { font-size: 9pt; color: #64748b; }
          #${PRINT_ROOT_ID} .value { font-family: ui-monospace, monospace; font-size: 15pt; font-weight: 700; letter-spacing: 0.5px; }
          #${PRINT_ROOT_ID} .hint { margin-top: auto; font-size: 8pt; color: #64748b; }
        }
      `}</style>
      {students.map((s) => (
        <div key={s.id} className="card">
          <div className="brand">EnQuiz · {className}</div>
          <div className="name">{s.fullName}</div>
          <div>
            <span className="label">Tên đăng nhập: </span>
            <span className="value">{s.username}</span>
          </div>
          <div>
            <span className="label">Mật khẩu: </span>
            <span className="value">{s.password}</span>
          </div>
          <div className="hint">Vào {loginUrl} để đăng nhập. Giữ thẻ cẩn thận, không cho bạn khác xem nhé!</div>
        </div>
      ))}
    </div>,
    document.body,
  )
}
