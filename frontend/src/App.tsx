import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';

import { LandingPage } from '@/pages/public/LandingPage';
import { VerifyDocumentPage } from '@/pages/public/VerifyDocumentPage';
import { VerifyMemberPage } from '@/pages/public/VerifyMemberPage';
import { SchedulePage } from '@/pages/public/SchedulePage';
import { MyKtaPage } from '@/pages/public/MyKtaPage';

import { LoginPage } from '@/pages/auth/LoginPage';
import { AuthCallbackPage } from '@/pages/auth/AuthCallbackPage';

import { DashboardOverview } from '@/pages/dashboard/DashboardOverview';
import { LettersListPage } from '@/pages/dashboard/letters/LettersListPage';
import { LetterCreatePage } from '@/pages/dashboard/letters/LetterCreatePage';
import { LetterDetailPage } from '@/pages/dashboard/letters/LetterDetailPage';
import { FinanceListPage } from '@/pages/dashboard/finance/FinanceListPage';
import { FinanceReportPage } from '@/pages/dashboard/finance/FinanceReportPage';
import { DivisionDetailPage } from '@/pages/dashboard/divisions/DivisionDetailPage';
import { UsersListPage } from '@/pages/dashboard/users/UsersListPage';
import { ProfilePage } from '@/pages/dashboard/ProfilePage';

import { NotFoundPage } from '@/pages/NotFoundPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Portal */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/verify" element={<VerifyDocumentPage />} />
          <Route path="/verify/:sha256" element={<VerifyDocumentPage />} />
          <Route path="/verify/member/:memberNumber" element={<VerifyMemberPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/members/me" element={<MyKtaPage />} />
        </Route>

        {/* Auth */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardOverview />} />
          <Route
            path="letters"
            element={
              <ProtectedRoute roles={['SEKRETARIS', 'KETUA_UMUM', 'DEWAN_PENGAWAS']}>
                <LettersListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="letters/create"
            element={
              <ProtectedRoute roles={['SEKRETARIS']}>
                <LetterCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="letters/:id"
            element={
              <ProtectedRoute roles={['SEKRETARIS', 'KETUA_UMUM', 'DEWAN_PENGAWAS']}>
                <LetterDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="letters/:id/edit"
            element={
              <ProtectedRoute roles={['SEKRETARIS']}>
                <LetterCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="finance"
            element={
              <ProtectedRoute roles={['BENDAHARA', 'KETUA_UMUM', 'DEWAN_PENGAWAS']}>
                <FinanceListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="finance/reports"
            element={
              <ProtectedRoute roles={['BENDAHARA', 'KETUA_UMUM', 'DEWAN_PENGAWAS']}>
                <FinanceReportPage />
              </ProtectedRoute>
            }
          />
          <Route path="divisions/:division" element={<DivisionDetailPage />} />
          <Route
            path="users"
            element={
              <ProtectedRoute roles={['SUPERADMIN', 'KETUA_UMUM', 'SEKRETARIS', 'BENDAHARA', 'DEWAN_PENGAWAS']}>
                <UsersListPage />
              </ProtectedRoute>
            }
          />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="/dashboard/divisions" element={<Navigate to="/dashboard" replace />} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
