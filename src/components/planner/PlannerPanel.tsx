import { Checkbox } from '@/components/common/Checkbox'
import { InlineAdd } from '@/components/common/InlineAdd'
import { SectionHeader } from '@/components/common/SectionHeader'
import { InlineEdit } from '@/components/common/InlineEdit'
import { formatDateLong, todayISO } from '@/lib/date'
import { nextTag } from '@/lib/entry'
import { tagVar } from '@/lib/tag'
import { usePlanner } from '@/store/PlannerContext'
import { EventAdd, draftToEvents } from './EventAdd'
import { EventTiming } from './EventTiming'
import styles from './PlannerPanel.module.css'

export function PlannerPanel() {
  const { selectedDate, eventsByDate, todosByDate, data, dispatch } = usePlanner()

  const events = eventsByDate.get(selectedDate) ?? []
  const todos = todosByDate.get(selectedDate) ?? []
  const note = data.notes[selectedDate] ?? ''
  const doneCount = todos.filter((t) => t.done).length
  const isToday = selectedDate === todayISO()

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <h2 className={styles.date}>{formatDateLong(selectedDate)}</h2>
        {isToday && <span className={styles.todayChip}>오늘</span>}
      </header>

      <section className={styles.section}>
        <SectionHeader title="일정" meta={events.length > 0 ? events.length : undefined} />

        {events.length > 0 && (
          <ul className={styles.list}>
            {events.map((e) => (
              <li key={e.id} className={styles.row}>
                <span className={styles.tagBar} style={{ background: tagVar(e.tag) }} />
                <div className={styles.rowBody}>
                  <InlineEdit
                    value={e.title}
                    label={e.title}
                    className={styles.rowTitle}
                    onCommit={(title) =>
                      dispatch({ type: 'UPDATE_EVENT', id: e.sourceId, patch: { title } })
                    }
                  />
                  <EventTiming event={e} />
                </div>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={
                    e.virtual ? `${e.title} 이 날만 건너뛰기` : `${e.title} 일정 삭제`
                  }
                  onClick={() =>
                    // 반복에서 펼쳐진 것은 그 날만 뺍니다. 전체를 지우려면 처음 적은 날에서.
                    e.virtual
                      ? dispatch({ type: 'SKIP_OCCURRENCE', id: e.sourceId, date: e.date })
                      : dispatch({ type: 'DELETE_EVENT', id: e.sourceId })
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <EventAdd
          date={selectedDate}
          onSubmit={(draft) =>
            // 고른 날마다 하나씩 — 날짜만 다르고 나머지는 같습니다.
            draftToEvents(draft).forEach((event) =>
              dispatch({
                type: 'ADD_EVENT',
                ...event,
                tag: event.tag ?? nextTag((eventsByDate.get(event.date) ?? []).length),
              }),
            )
          }
        />
      </section>

      <section className={styles.section}>
        <SectionHeader
          title="할 일"
          meta={todos.length > 0 ? `${doneCount}/${todos.length}` : undefined}
        />

        {todos.length > 0 && (
          <ul className={styles.list}>
            {todos.map((t) => (
              <li key={t.id} className={styles.row}>
                <Checkbox
                  checked={t.done}
                  label={t.title}
                  onChange={() => dispatch({ type: 'TOGGLE_TODO', id: t.id })}
                />
                <InlineEdit
                  value={t.title}
                  label={t.title}
                  className={styles.todoTitle}
                  dataDone={t.done}
                  onCommit={(title) => dispatch({ type: 'UPDATE_TODO', id: t.id, patch: { title } })}
                />
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`${t.title} 할 일 삭제`}
                  onClick={() => dispatch({ type: 'DELETE_TODO', id: t.id })}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <InlineAdd
          label="할 일 추가"
          placeholder="무엇을 할까요?"
          onSubmit={(title) => dispatch({ type: 'ADD_TODO', date: selectedDate, title })}
        />
      </section>

      <section className={styles.noteSection}>
        <SectionHeader title="메모" />
        <textarea
          className={styles.note}
          value={note}
          placeholder="이 날에 대해 남기고 싶은 것"
          onChange={(e) => dispatch({ type: 'SET_NOTE', date: selectedDate, text: e.target.value })}
        />
      </section>
    </div>
  )
}
