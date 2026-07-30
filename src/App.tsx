import { AppShell } from '@/components/layout/AppShell'
import { PlannerPanel } from '@/components/planner/PlannerPanel'
import { usePlanner } from '@/store/PlannerContext'
import { GoalsView } from '@/views/GoalsView'
import { HomeView } from '@/views/HomeView'
import { MandalView } from '@/views/MandalView'
import { MindMapView } from '@/views/MindMapView'
import { MonthView } from '@/views/MonthView'
import { SearchView } from '@/views/SearchView'
import { SettingsView } from '@/views/SettingsView'
import { StudyView } from '@/views/StudyView'
import { TodayView } from '@/views/TodayView'
import { WeekView } from '@/views/WeekView'

/**
 * Sidebar 의 view 하나로 화면을 갈아끼웁니다.
 *
 * 우측 Planner 는 '선택한 날짜'를 보여주는 패널이라,
 * 날짜를 고르는 뷰(월간·주간)에만 붙입니다.
 * 오늘 뷰는 이미 하루를 펼쳐 보여주므로 붙이면 같은 내용이 두 번 나옵니다.
 */
export function App() {
  const { view } = usePlanner()

  switch (view) {
    case 'home':
      return <AppShell center={<HomeView />} />

    case 'search':
      return <AppShell center={<SearchView />} />

    case 'today':
      return <AppShell center={<TodayView />} />

    case 'week':
      return <AppShell center={<WeekView />} right={<PlannerPanel />} />

    case 'month':
      return <AppShell center={<MonthView />} right={<PlannerPanel />} />

    case 'goals':
      return <AppShell center={<GoalsView />} />

    case 'mandal':
      return <AppShell center={<MandalView />} />

    case 'mindmap':
      return <AppShell center={<MindMapView />} />

    case 'study':
      return <AppShell center={<StudyView />} />

    case 'settings':
      return <AppShell center={<SettingsView />} />

    default:
      return <AppShell center={<HomeView />} />
  }
}
