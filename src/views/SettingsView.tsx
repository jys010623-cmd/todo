import { useRef, useState } from 'react'

import { Segmented } from '@/components/common/Segmented'
import { PageHeader } from '@/components/layout/PageHeader'
import { todayISO } from '@/lib/date'
import { parseData } from '@/lib/storage'
import { createInitialData } from '@/store/initial'
import { usePlanner } from '@/store/PlannerContext'
import type { PlannerData } from '@/types'
import styles from './SettingsView.module.css'

/** 액센트 후보 — 태그 팔레트의 solid 값을 그대로 씁니다. 전부 지면 대비 3:1 이상입니다. */
/**
 * 어디서 본 듯한 값들로 골랐습니다 — 요즘 웹앱들이 공통으로 쓰는 자리입니다.
 * 색 위의 글자색은 고정하지 않고 색마다 자동으로 고릅니다(readableOn).
 * 전부 흰 글자에 맞추려 어둡게 내리면 초록·주황이 탁해집니다.
 */
const ACCENTS: { value: string; label: string }[] = [
  { value: '#4f46e5', label: '인디고' },
  { value: '#2563eb', label: '블루' },
  { value: '#10b981', label: '에메랄드' },
  { value: '#f43f5e', label: '로즈' },
  { value: '#f59e0b', label: '앰버' },
  { value: '#18181b', label: '잉크' },
]

interface StepperProps {
  label: string
  value: number
  step: number
  min: number
  max: number
  onChange: (value: number) => void
}

/** 스터디 화면의 주간 목표와 같은 방식 — 숫자를 직접 치게 하지 않습니다. */
function Stepper({ label, value, step, min, max, onChange }: StepperProps) {
  return (
    <div className={styles.stepper}>
      <span className={styles.stepperLabel}>{label}</span>
      <button
        type="button"
        className={styles.stepperBtn}
        aria-label={`${label} ${step}분 줄이기`}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        −
      </button>
      <span className={styles.stepperValue}>{value}분</span>
      <button
        type="button"
        className={styles.stepperBtn}
        aria-label={`${label} ${step}분 늘리기`}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        +
      </button>
    </div>
  )
}

export function SettingsView() {
  const { data, dispatch } = usePlanner()
  const { settings } = data

  // 되돌릴 수 없는 동작이라 한 번 더 누르게 합니다.
  const [confirming, setConfirming] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  /** 가져오기 결과 한 줄 — 성공도 실패도 조용히 지나가면 뭐가 됐는지 알 수 없습니다. */
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `planme-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importData = async (file: File) => {
    try {
      // 저장된 것을 읽을 때와 같은 길을 태웁니다 — 검사를 따로 쓰면 둘이 어긋납니다.
      const next = parseData(JSON.parse(await file.text()))
      if (!next) {
        setImportMsg({ ok: false, text: 'PlanMe 백업 파일이 아닙니다.' })
        return
      }
      dispatch({ type: 'REPLACE', data: next })
      setImportMsg({
        ok: true,
        text: `가져왔습니다. 일정 ${next.events.length} · 할 일 ${next.todos.length}`,
      })
    } catch {
      setImportMsg({ ok: false, text: '파일을 읽지 못했습니다.' })
    }
  }

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
            <h2 className={styles.labelTitle}>테마</h2>
            <p className={styles.labelBody}>
              시스템을 고르면 기기 설정을 따라가, 밤이 되면 저절로 어두워집니다.
            </p>
          </div>
          <Segmented
            label="테마"
            value={settings.theme}
            options={[
              { value: 'light', label: '밝게' },
              { value: 'dark', label: '어둡게' },
              { value: 'system', label: '시스템' },
            ]}
            onChange={(theme) => dispatch({ type: 'SET_SETTINGS', patch: { theme } })}
          />
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
            <h2 className={styles.labelTitle}>뽀모도로</h2>
            <p className={styles.labelBody}>
              켜면 스터디 타이머가 정해진 시간만큼 세다가 저절로 쉬는 시간으로 넘어갑니다.
              집중한 만큼은 그때 기록되고, 쉬는 동안은 세지 않습니다.
            </p>
          </div>
          <div className={styles.actions}>
            <Segmented
              label="뽀모도로"
              value={settings.pomodoro.enabled ? 'on' : 'off'}
              options={[
                { value: 'off', label: '끄기' },
                { value: 'on', label: '켜기' },
              ]}
              onChange={(v) =>
                dispatch({
                  type: 'SET_SETTINGS',
                  patch: { pomodoro: { ...settings.pomodoro, enabled: v === 'on' } },
                })
              }
            />
          </div>
        </section>

        {settings.pomodoro.enabled && (
          <section className={styles.row}>
            <div className={styles.label}>
              <h2 className={styles.labelTitle}>집중과 휴식</h2>
              <p className={styles.labelBody}>한 번에 얼마나 집중하고 얼마나 쉴지.</p>
            </div>
            <div className={styles.actions}>
              <Stepper
                label="집중"
                value={settings.pomodoro.focusMin}
                step={5}
                min={5}
                max={90}
                onChange={(focusMin) =>
                  dispatch({
                    type: 'SET_SETTINGS',
                    patch: { pomodoro: { ...settings.pomodoro, focusMin } },
                  })
                }
              />
              <Stepper
                label="휴식"
                value={settings.pomodoro.breakMin}
                step={1}
                min={1}
                max={30}
                onChange={(breakMin) =>
                  dispatch({
                    type: 'SET_SETTINGS',
                    patch: { pomodoro: { ...settings.pomodoro, breakMin } },
                  })
                }
              />
            </div>
          </section>
        )}

        <section className={styles.row}>
          <div className={styles.label}>
            <h2 className={styles.labelTitle}>백업</h2>
            <p className={styles.labelBody}>
              기록은 이 브라우저에만 있습니다. 방문 기록을 지우거나 브라우저를 바꾸면 함께
              사라지니, 가끔 파일로 내려받아 두세요. 가져오면 지금 기록을 덮어씁니다.
            </p>
            {importMsg && (
              <p className={styles.note} data-error={!importMsg.ok || undefined}>
                {importMsg.text}
              </p>
            )}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={exportData}>
              내보내기
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => fileRef.current?.click()}
            >
              가져오기
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                // 같은 파일을 다시 골라도 change 가 나도록 비웁니다.
                e.target.value = ''
                if (file) void importData(file)
              }}
            />
          </div>
        </section>

        <section className={styles.row}>
          <div className={styles.label}>
            <h2 className={styles.labelTitle}>데이터</h2>
            <p className={styles.labelBody}>
              일정 {data.events.length} · 할 일 {data.todos.length} · 목표 {data.goals.length} ·
              위시리스트 {data.wishes.length} · 만다라트 {data.mandals.length} · 마인드맵{' '}
              {data.mindmaps.length} · 과목 {data.subjects.length} · 메모{' '}
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
