import { useEffect, useMemo, useRef, useState } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { KIND_LABEL, groupHits, search, type SearchHit } from '@/lib/search'
import { usePlanner } from '@/store/PlannerContext'
import styles from './SearchView.module.css'

export function SearchView() {
  const { data, setView, selectDate } = usePlanner()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // 이 화면에 온 이유는 하나뿐입니다 — 바로 적을 수 있어야 합니다.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const groups = useMemo(() => groupHits(search(data, query)), [data, query])
  const total = groups.reduce((sum, g) => sum + g.hits.length + g.more, 0)

  const go = (hit: SearchHit) => {
    // 날짜가 있는 것은 그 날로 옮겨 놓고 화면을 바꿔야, 열자마자 그 자리가 보입니다.
    if (hit.date) selectDate(hit.date)
    setView(hit.view)
  }

  return (
    <div className={styles.scroll}>
      <PageHeader
        title="검색"
        subtitle={query.trim() ? `${total}개 찾음` : '적어 둔 모든 곳에서 찾습니다'}
      />

      <div className={styles.body}>
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          placeholder="무엇을 찾으시나요?"
          aria-label="검색어"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('')
          }}
        />

        {!query.trim() ? (
          <p className={styles.hint}>
            일정과 할 일, 메모, 목표와 단계, 만다라트 칸, 마인드맵 노드, 위시리스트,
            과목까지 한 번에 찾습니다. 찾은 것을 누르면 그 화면의 그 날짜로 갑니다.
          </p>
        ) : groups.length === 0 ? (
          <p className={styles.hint}>찾는 것이 없습니다.</p>
        ) : (
          <div className={styles.groups}>
            {groups.map((group) => (
              <section key={group.kind} className={styles.group}>
                <h2 className={styles.groupTitle}>
                  {KIND_LABEL[group.kind]}
                  <span className={styles.groupCount}>{group.hits.length + group.more}</span>
                </h2>

                <ul className={styles.list}>
                  {group.hits.map((hit) => (
                    <li key={hit.id}>
                      <button type="button" className={styles.hit} onClick={() => go(hit)}>
                        <span className={styles.hitText}>{hit.text}</span>
                        {hit.context && <span className={styles.hitContext}>{hit.context}</span>}
                      </button>
                    </li>
                  ))}
                </ul>

                {group.more > 0 && (
                  <p className={styles.more}>
                    검색어를 더 좁히면 나머지 {group.more}개도 볼 수 있습니다
                  </p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
