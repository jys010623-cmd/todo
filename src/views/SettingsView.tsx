import { useState } from 'react'

import { Segmented } from '@/components/common/Segmented'
import { PageHeader } from '@/components/layout/PageHeader'
import { createInitialData } from '@/store/initial'
import { usePlanner } from '@/store/PlannerContext'
import type { PlannerData } from '@/types'
import styles from './SettingsView.module.css'

/** 액센트 후보 — 태그 팔레트의 solid 값을 그대로 씁니다. 전부 지면 대비 3:1 이상입니다. */
const ACCENTS: { value: string; label: string }[] = [
  { value: '#6e56cf', label: '라일락' },
  { value: '#3e63dd', label: '블루' },
  { value: '#2b9a66', label: '민트' },
  { value: '#e54d2e', label: '코랄' },
  { value: '#bf8100', label: '허니' },
  { value: '#31322e', label: '잉크' },
]

export function SettingsView() {
  const { data, dispatch } = usePlanner()
  const { settings } = data

  // 되돌릴 수 없는 동작이라 한 번 더 누르게 합니다.
  const [confirming, setConfirming] = useState(false)

  const clearAll = () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    // 설정은 취향이라 남기고, 기록만 비웁니다.
    // 빈 상태를 여기서 다시 적으면 영역이 늘 때마다 빠뜨리게 되어 초기값을 그대로 씁니다.
    const next: PlannerData = { ...createInitialData(), settings }
    dispatch({ type: 'REPLACE', data: next })
    setConfirming(false)
  }

  return (
    <div className={styles.scroll}>
      <PageHeader title="설정" />

      <div className={styles.body}>
        <section className={styles.row}>
          <div className={styles.label}>
            <h2 className={styles.labelTitle}>액센트</h2>
            <p className={styles.labelBody}>오늘 표식을 뺀 모든 강조에 쓰입니다.</p>
          </div>
          <div className={styles.swatches}>
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                type="button"
                className={styles.swatch}
                style={{ background: a.value }}
                aria-label={a.label}
                aria-pressed={settings.accent === a.value}
                data-active={settings.accent === a.value || undefined}
                onClick={() => dispatch({ type: 'SET_SETTINGS', patch: { accent: a.value } })}
              />
            ))}
          </div>
        </section>

        <section className={styles.row}>
          <div className={styles.label}>
            <h2 className={styles.labelTitle}>주 시작 요일</h2>
            <p className={styles.labelBody}>달력과 주간 뷰의 첫 칸이 바뀝니다.</p>
          </div>
          <Segmented
            label="주 시작 요일"
            value={settings.weekStart}
            options={[
              { value: 0, label: '일요일' },
              { value: 1, label: '월요일' },
            ]}
            onChange={(weekStart) => dispatch({ type: 'SET_SETTINGS', patch: { weekStart } })}
          />
        </section>

        <section className={styles.row}>
          <div className={styles.label}>
            <h2 className={styles.labelTitle}>시간 표기</h2>
            <p className={styles.labelBody}>일정 시간을 어떻게 읽을지 정합니다.</p>
          </div>
          <Segmented
            label="시간 표기"
            value={settings.hour12 ? 'h12' : 'h24'}
            options={[
              { value: 'h24', label: '24시간' },
              { value: 'h12', label: '오전 · 오후' },
            ]}
            onChange={(v) => dispatch({ type: 'SET_SETTINGS', patch: { hour12: v === 'h12' } })}
          />
        </section>

        <section className={styles.row}>
          <div className={styles.label}>
            <h2 className={styles.labelTitle}>데이터</h2>
            <p className={styles.labelBody}>
              이 브라우저에만 저장됩니다. 일정 {data.events.length} · 할 일 {data.todos.length} ·
              목표 {data.goals.length} · 위시리스트 {data.wishes.length} · 만다라트{' '}
              {data.mandals.length} · 과목 {data.subjects.length} · 메모{' '}
              {Object.keys(data.notes).length}
            </p>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.danger}
              data-confirming={confirming || undefined}
              onClick={clearAll}
              onBlur={() => setConfirming(false)}
            >
              {confirming ? '정말 비울까요?' : '전부 비우기'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
