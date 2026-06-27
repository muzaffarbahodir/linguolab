import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { withSentryReactRouterV6Routing } from '@sentry/react';
import WebApp from '@twa-dev/sdk';

const SentryRoutes = withSentryReactRouterV6Routing(Routes);

import { useAuthStore } from './store/auth';
import { useUIStore } from './store/ui';
import { useMe } from './api/users';
import { BottomNav } from './components/BottomNav';
import { ToastViewport } from './components/ToastViewport';
import { AnnouncementMarquee } from './components/AnnouncementMarquee';
import { DiscoveryWizard } from './components/DiscoveryWizard';
import { RoleGate } from './pages/RoleGate';

// ── Critical (eager) ──────────────────────────────────────────────────────────
import { HomePage } from './pages/Home';
import { ProfilePage } from './pages/Profile';
import { NotInTelegramPage } from './pages/NotInTelegram';
import { Onboarding } from './pages/Onboarding';

// ── Lazy chunks ───────────────────────────────────────────────────────────────
const SchedulePage = lazy(() =>
  import('./pages/Schedule').then((m) => ({ default: m.SchedulePage })),
);
const CoursesPage = lazy(() => import('./pages/Courses').then((m) => ({ default: m.CoursesPage })));
const CourseDetailPage = lazy(() =>
  import('./pages/CourseDetail').then((m) => ({ default: m.CourseDetailPage })),
);
const BookingPage = lazy(() => import('./pages/Booking').then((m) => ({ default: m.BookingPage })));
const LanguageSelectPage = lazy(() =>
  import('./pages/LanguageSelect').then((m) => ({ default: m.LanguageSelectPage })),
);
const HomeworkPage = lazy(() =>
  import('./pages/Homework').then((m) => ({ default: m.HomeworkPage })),
);
const AchievementsPage = lazy(() =>
  import('./pages/Achievements').then((m) => ({ default: m.AchievementsPage })),
);
const CertificatesPage = lazy(() =>
  import('./pages/Certificates').then((m) => ({ default: m.CertificatesPage })),
);
const PaymentPage = lazy(() => import('./pages/Payment'));
const PlacementTestPage = lazy(() =>
  import('./pages/PlacementTest').then((m) => ({ default: m.PlacementTestPage })),
);
const NotificationsPage = lazy(() =>
  import('./pages/Notifications').then((m) => ({ default: m.NotificationsPage })),
);
const SupportPage = lazy(() => import('./pages/Support').then((m) => ({ default: m.SupportPage })));
const AttendancePage = lazy(() =>
  import('./pages/Attendance').then((m) => ({ default: m.AttendancePage })),
);
const SettingsPage = lazy(() =>
  import('./pages/Settings').then((m) => ({ default: m.SettingsPage })),
);
// Teacher
const TeacherHomePage = lazy(() =>
  import('./pages/teacher/TeacherHome').then((m) => ({ default: m.TeacherHomePage })),
);
const TeacherClassPage = lazy(() =>
  import('./pages/teacher/TeacherClass').then((m) => ({ default: m.TeacherClassPage })),
);
const TeacherAttendancePage = lazy(() =>
  import('./pages/teacher/TeacherAttendance').then((m) => ({ default: m.TeacherAttendancePage })),
);
const TeacherSubmissionsPage = lazy(() =>
  import('./pages/teacher/TeacherSubmissions').then((m) => ({ default: m.TeacherSubmissionsPage })),
);
const TeacherPendingHwPage = lazy(() =>
  import('./pages/teacher/TeacherPendingHw').then((m) => ({ default: m.TeacherPendingHwPage })),
);
const TeacherStudentPage = lazy(() =>
  import('./pages/teacher/TeacherStudentPage').then((m) => ({ default: m.TeacherStudentPage })),
);
const TeacherProfilePage = lazy(() =>
  import('./pages/teachers/TeacherProfilePage').then((m) => ({ default: m.TeacherProfilePage })),
);
const TeacherStatsPage = lazy(() =>
  import('./pages/teacher/TeacherStats').then((m) => ({ default: m.TeacherStatsPage })),
);
const TeacherClassRequestsPage = lazy(() =>
  import('./pages/teacher/TeacherClassRequests').then((m) => ({
    default: m.TeacherClassRequestsPage,
  })),
);
// Parent
const ParentHomePage = lazy(() =>
  import('./pages/parent/ParentHome').then((m) => ({ default: m.ParentHomePage })),
);
const ParentChildPage = lazy(() =>
  import('./pages/parent/ParentChild').then((m) => ({ default: m.ParentChildPage })),
);
const ParentLinkPage = lazy(() =>
  import('./pages/parent/ParentLinkPage').then((m) => ({ default: m.ParentLinkPage })),
);
// Admin
const AdminHomePage = lazy(() =>
  import('./pages/admin/AdminHome').then((m) => ({ default: m.AdminHomePage })),
);
const AdminUsersPage = lazy(() =>
  import('./pages/admin/AdminUsers').then((m) => ({ default: m.AdminUsersPage })),
);
const AdminBroadcastPage = lazy(() =>
  import('./pages/admin/AdminBroadcast').then((m) => ({ default: m.AdminBroadcastPage })),
);
const AdminAuditPage = lazy(() =>
  import('./pages/admin/AdminAudit').then((m) => ({ default: m.AdminAuditPage })),
);
const AdminStudentsPage = lazy(() =>
  import('./pages/admin/AdminStudents').then((m) => ({ default: m.AdminStudentsPage })),
);
const AdminFinancePage = lazy(() =>
  import('./pages/admin/AdminFinance').then((m) => ({ default: m.AdminFinancePage })),
);
const AdminTransfersPage = lazy(() =>
  import('./pages/admin/AdminTransfers').then((m) => ({ default: m.AdminTransfersPage })),
);
const AdminTrialsPage = lazy(() =>
  import('./pages/admin/AdminTrials').then((m) => ({ default: m.AdminTrialsPage })),
);
const AdminSupportPage = lazy(() =>
  import('./pages/admin/AdminSupport').then((m) => ({ default: m.AdminSupportPage })),
);
const AdminTeachersPage = lazy(() =>
  import('./pages/admin/AdminTeachers').then((m) => ({ default: m.AdminTeachersPage })),
);
const AdminClassesPage = lazy(() =>
  import('./pages/admin/AdminClasses').then((m) => ({ default: m.AdminClassesPage })),
);
const AdminAnalyticsPage = lazy(() =>
  import('./pages/admin/AdminAnalytics').then((m) => ({ default: m.AdminAnalyticsPage })),
);
const AdminEnrollmentsPage = lazy(() =>
  import('./pages/admin/AdminEnrollments').then((m) => ({ default: m.AdminEnrollmentsPage })),
);
const AdminCertificatesPage = lazy(() =>
  import('./pages/admin/AdminCertificates').then((m) => ({ default: m.AdminCertificatesPage })),
);
const AdminPaymentSettingsPage = lazy(() =>
  import('./pages/admin/AdminPaymentSettings').then((m) => ({
    default: m.AdminPaymentSettingsPage,
  })),
);
const AdminReferralsPage = lazy(() =>
  import('./pages/admin/AdminReferrals').then((m) => ({ default: m.AdminReferralsPage })),
);
const AdminLanguagesPage = lazy(() =>
  import('./pages/admin/AdminLanguages').then((m) => ({ default: m.AdminLanguagesPage })),
);
const AdminAnnouncementsPage = lazy(() =>
  import('./pages/admin/AdminAnnouncements').then((m) => ({ default: m.AdminAnnouncementsPage })),
);
const AdminHrPage = lazy(() =>
  import('./pages/admin/AdminHr').then((m) => ({ default: m.AdminHrPage })),
);
const AdminClassRequestsPage = lazy(() =>
  import('./pages/admin/AdminClassRequests').then((m) => ({ default: m.AdminClassRequestsPage })),
);

// Spinner для Suspense
function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div
        className="h-7 w-7 animate-spin rounded-full border-4 border-t-transparent"
        style={{ borderColor: 'rgba(108,92,231,0.3)', borderTopColor: '#6C5CE7' }}
      />
    </div>
  );
}

/**
 * App — корневой компонент.
 *
 * Auth flow:
 *   idle / loading  → показываем загрузчик (auth init в процессе, main.tsx запустил login)
 *   not_in_telegram → NotInTelegramPage (запущено вне Telegram)
 *   error           → показываем ошибку с кнопкой retry
 *   authenticated   → основной лейаут (BottomNav + Routes)
 *
 * Layout: контент сверху, BottomNav — fixed снизу.
 * pb-24 на main — чтобы контент не уезжал под нав-бар.
 */
export default function App() {
  const status = useAuthStore((s) => s.status);
  const { t } = useTranslation();

  // Загрузка / ожидание auth init
  if (status === 'idle' || status === 'loading') {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: '#1a1e27' }}
      >
        <div className="floral-float flex flex-col items-center gap-3">
          <div
            className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
            style={{ borderColor: 'rgba(108,92,231,0.3)', borderTopColor: '#6C5CE7' }}
          />
          <span className="text-xs font-medium" style={{ color: 'var(--faint)' }}>
            LinguoLab
          </span>
        </div>
      </div>
    );
  }

  if (status === 'not_in_telegram') {
    return <NotInTelegramPage />;
  }

  if (status === 'error') {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
        style={{ background: '#1a1e27' }}
      >
        <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>
          {t('app.server_error')}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="glass-btn rounded-xl px-6 py-2.5 text-sm font-semibold"
        >
          {t('app.retry')}
        </button>
      </div>
    );
  }

  // Авторизован — основной интерфейс
  return <AuthenticatedApp />;
}

/** Вынесено чтобы использовать useLocation внутри Router-контекста */
function AuthenticatedApp() {
  const location = useLocation();
  const realRole = useAuthStore((s) => s.user?.role);
  const isActive = useAuthStore((s) => s.user?.is_active);
  const previewRole = useAuthStore((s) => s.previewRole);
  const bottomSheetOpen = useUIStore((s) => s.bottomSheetOpen);

  // Активная роль: если admin включил превью — используем её для UI/nav
  const role = previewRole ?? realRole;
  const isRealAdmin = realRole === 'ADMIN' || realRole === 'SUPER_ADMIN' || realRole === 'MANAGER';

  // ── Onboarding check ────────────────────────────────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  // Новый клиент может «просто посмотреть курсы» до выбора роли (витрина).
  const [browse, setBrowse] = useState(false);

  // Профиль (для гейта опроса подбора при старте).
  const { data: me, refetch: refetchMe } = useMe();

  useEffect(() => {
    if (realRole && realRole !== 'STUDENT' && realRole !== 'PARENT') {
      setOnboardingChecked(true);
      return;
    }
    WebApp.CloudStorage.getItem('onboarding_done', (err, value) => {
      if (!err && value === 'done') {
        setShowOnboarding(false);
      } else {
        setShowOnboarding(true);
      }
      setOnboardingChecked(true);
    });
  }, [realRole]);

  // Страницы без нижнего нав-бара и без padding-bottom
  const isFullscreen =
    [
      '/book',
      '/homework',
      '/achievements',
      '/payment',
      '/placement-test',
      '/notifications',
      '/certificates',
      '/support',
      '/attendance',
      '/settings',
    ].includes(location.pathname) ||
    location.pathname.startsWith('/teacher') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/parent/child/') ||
    location.pathname === '/parent/link';

  // Родителям и админам без превью — никогда не показываем BottomNav
  const isParent = role === 'PARENT';
  const showBottomNav =
    !isFullscreen &&
    !(isRealAdmin && !previewRole) &&
    !isParent &&
    !showOnboarding &&
    !bottomSheetOpen;

  // Ждём проверки CloudStorage
  if (!onboardingChecked) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: '#1a1e27' }}
      >
        <div
          className="h-6 w-6 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: 'rgba(108,92,231,0.3)', borderTopColor: '#6C5CE7' }}
        />
      </div>
    );
  }

  // Новый клиент (студент/родитель) ещё не активирован → выбор роли + авто-активация.
  // Может нажать «посмотреть курсы» → витрина (browse), без выбора роли.
  // Убирает тупик «ждите подтверждения менеджера».
  if ((realRole === 'STUDENT' || realRole === 'PARENT') && isActive === false && !browse) {
    return <RoleGate onBrowse={() => setBrowse(true)} />;
  }

  // Опрос подбора курса (как в Udemy) — сразу при открытии, до основного
  // интерфейса. Только активный студент/родитель, который ещё не проходил.
  if (
    (realRole === 'STUDENT' || realRole === 'PARENT') &&
    isActive !== false &&
    me &&
    !me.discovery_done_at
  ) {
    return <DiscoveryWizard onDone={() => void refetchMe()} />;
  }

  return (
    <div className="min-h-screen" style={{ color: 'var(--tg-theme-text-color, #fff)' }}>
      <ToastViewport />
      <OfflineBanner />
      <AnnouncementMarquee />
      {showOnboarding && <Onboarding onClose={() => setShowOnboarding(false)} />}

      {/* Role preview banner */}
      {isRealAdmin && previewRole && <RolePreviewBanner previewRole={previewRole} />}

      <main className={isFullscreen || !showBottomNav ? '' : 'pb-24'}>
        <Suspense fallback={<PageLoader />}>
          <SentryRoutes>
            {/* ── Root — role-based redirect ── */}
            <Route
              path="/"
              element={
                isActive === false ? (
                  <Navigate to="/courses" replace />
                ) : role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MANAGER' ? (
                  <Navigate to="/profile" replace />
                ) : role === 'TEACHER' ? (
                  <Navigate to="/teacher" replace />
                ) : role === 'PARENT' ? (
                  <Navigate to="/parent" replace />
                ) : (
                  <HomePage />
                )
              }
            />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/course/:languageId" element={<CourseDetailPage />} />
            <Route path="/onboard" element={<RoleGate />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/book" element={<BookingPage />} />
            <Route path="/language" element={<LanguageSelectPage />} />
            <Route path="/homework" element={<HomeworkPage />} />
            <Route path="/achievements" element={<AchievementsPage />} />
            <Route path="/certificates" element={<CertificatesPage />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/placement-test" element={<PlacementTestPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/attendance" element={<AttendancePage />} />

            {/* ── Parent cabinet ── */}
            <Route path="/parent" element={<ParentHomePage />} />
            <Route path="/parent/child/:childId" element={<ParentChildPage />} />
            <Route path="/parent/link" element={<ParentLinkPage />} />

            {/* ── Teacher cabinet ── */}
            <Route path="/teacher" element={<TeacherHomePage />} />
            <Route path="/teacher/class/:classId" element={<TeacherClassPage />} />
            <Route
              path="/teacher/class/:classId/student/:studentId"
              element={<TeacherStudentPage />}
            />
            <Route
              path="/teacher/lesson/:lessonId/attendance"
              element={<TeacherAttendancePage />}
            />
            <Route path="/teachers/:teacherId" element={<TeacherProfilePage />} />
            <Route path="/teacher/homework" element={<TeacherPendingHwPage />} />
            <Route
              path="/teacher/homework/:homeworkId/submissions"
              element={<TeacherSubmissionsPage />}
            />

            {/* ── Admin panel ── */}
            <Route path="/admin" element={<AdminHomePage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/students" element={<AdminStudentsPage />} />
            <Route path="/admin/broadcast" element={<AdminBroadcastPage />} />
            <Route path="/admin/audit" element={<AdminAuditPage />} />
            <Route path="/admin/finance" element={<AdminFinancePage />} />
            <Route path="/admin/transfers" element={<AdminTransfersPage />} />
            <Route path="/admin/trials" element={<AdminTrialsPage />} />
            <Route path="/admin/support" element={<AdminSupportPage />} />
            <Route path="/admin/teachers" element={<AdminTeachersPage />} />
            <Route path="/admin/classes" element={<AdminClassesPage />} />
            <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
            <Route path="/admin/enrollments" element={<AdminEnrollmentsPage />} />
            <Route path="/admin/certificates" element={<AdminCertificatesPage />} />
            <Route path="/admin/payment-settings" element={<AdminPaymentSettingsPage />} />
            <Route path="/admin/referrals" element={<AdminReferralsPage />} />
            <Route path="/admin/languages" element={<AdminLanguagesPage />} />
            <Route path="/admin/announcements" element={<AdminAnnouncementsPage />} />
            <Route path="/admin/hr" element={<AdminHrPage />} />
            <Route path="/admin/class-requests" element={<AdminClassRequestsPage />} />
            <Route path="/teacher/stats" element={<TeacherStatsPage />} />
            <Route path="/teacher/class-requests" element={<TeacherClassRequestsPage />} />

            {/* fallback */}
            <Route
              path="*"
              element={
                <Navigate
                  to={
                    role === 'TEACHER'
                      ? '/teacher'
                      : role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MANAGER'
                        ? '/profile'
                        : role === 'PARENT'
                          ? '/parent'
                          : '/'
                  }
                  replace
                />
              }
            />
          </SentryRoutes>
        </Suspense>
      </main>
      {showBottomNav && <BottomNav previewRole={previewRole ?? undefined} />}
    </div>
  );
}

// ── Offline banner ────────────────────────────────────────────────────────────

function OfflineBanner() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      className="fixed left-0 right-0 top-0 z-[110] flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-semibold text-white"
      style={{ background: 'rgba(239,68,68,0.95)', backdropFilter: 'blur(8px)' }}
    >
      <span>📡</span>
      {t('app.offline')}
    </div>
  );
}

// ── Role preview banner ───────────────────────────────────────────────────────

const PREVIEW_LABEL: Record<string, string> = {
  STUDENT: 'Студент',
  TEACHER: 'Учитель',
  PARENT: 'Родитель',
  MANAGER: 'Менеджер',
};

function RolePreviewBanner({ previewRole }: { previewRole: string }) {
  const setPreviewRole = useAuthStore((s) => s.setPreviewRole);
  return (
    <div
      className="fixed left-0 right-0 top-0 z-[100] flex items-center justify-between px-4 py-2"
      style={{ background: 'rgba(245,158,11,0.95)', backdropFilter: 'blur(8px)' }}
    >
      <span className="text-xs font-bold text-black">
        👁 Превью: {PREVIEW_LABEL[previewRole] ?? previewRole}
      </span>
      <button
        onClick={() => setPreviewRole(null)}
        className="rounded-lg bg-black/20 px-3 py-1 text-xs font-bold text-black"
      >
        ✕ Выйти
      </button>
    </div>
  );
}
