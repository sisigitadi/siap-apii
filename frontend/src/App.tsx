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

import { DemoPage } from '@/pages/demo/DemoPage';

import { DashboardOverview } from '@/pages/dashboard/DashboardOverview';
import { LettersListPage } from '@/pages/dashboard/letters/LettersListPage';
import { LetterCreatePage } from '@/pages/dashboard/letters/LetterCreatePage';
import { LetterDetailPage } from '@/pages/dashboard/letters/LetterDetailPage';
import { FinanceListPage } from '@/pages/dashboard/finance/FinanceListPage';
import { FinanceReportPage } from '@/pages/dashboard/finance/FinanceReportPage';
import { DivisionDetailPage } from '@/pages/dashboard/divisions/DivisionDetailPage';
import { UsersListPage } from '@/pages/dashboard/users/UsersListPage';
import { ProfilePage } from '@/pages/dashboard/ProfilePage';

import { KetuaPage } from '@/pages/dashboard/roles/KetuaPage';
import { SekretarisPage } from '@/pages/dashboard/roles/SekretarisPage';
import { BendaharaPage } from '@/pages/dashboard/roles/BendaharaPage';
import { PembinaPage } from '@/pages/dashboard/roles/PembinaPage';
import { PengawasPage } from '@/pages/dashboard/roles/PengawasPage';
import { DivisiPage } from '@/pages/dashboard/roles/DivisiPage';
import { AnggotaBiasaPage } from '@/pages/dashboard/roles/AnggotaBiasaPage';

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

        {/* Demo mode: akses semua role + halaman publik */}
        <Route path="/demo" element={<DemoPage />} />

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

          {/* Halaman per-jabatan */}
          <Route
            path="ketua"
            element={
              <ProtectedRoute roles={['KETUA']}>
                <KetuaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="sekretaris"
            element={
              <ProtectedRoute roles={['SEKRETARIS']}>
                <SekretarisPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="bendahara"
            element={
              <ProtectedRoute roles={['BENDAHARA']}>
                <BendaharaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="pembina"
            element={
              <ProtectedRoute roles={['PEMBINA']}>
                <PembinaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="pengawas"
            element={
              <ProtectedRoute roles={['PENGAWAS']}>
                <PengawasPage />
              </ProtectedRoute>
            }
          />
          {/* Ketua Divisi & Anggota Divisi berbagi tempat yang sama */}
          <Route
            path="divisi"
            element={
              <ProtectedRoute roles={['KETUA_DIVISI', 'ANGGOTA_DIVISI']}>
                <DivisiPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="anggota"
            element={
              <ProtectedRoute roles={['ANGGOTA_BIASA']}>
                <AnggotaBiasaPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="letters"
            element={
              <ProtectedRoute roles={['SEKRETARIS', 'KETUA', 'PEMBINA', 'PENGAWAS']}>
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
              <ProtectedRoute roles={['SEKRETARIS', 'KETUA', 'PEMBINA', 'PENGAWAS']}>
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
              <ProtectedRoute roles={['BENDAHARA', 'KETUA', 'PEMBINA', 'PENGAWAS']}>
                <FinanceListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="finance/reports"
            element={
              <ProtectedRoute roles={['BENDAHARA', 'KETUA', 'PEMBINA', 'PENGAWAS']}>
                <FinanceReportPage />
              </ProtectedRoute>
            }
          />
          <Route path="divisions/:division" element={<DivisionDetailPage />} />
          <Route
            path="users"
            element={
              <ProtectedRoute roles={['SUPERADMIN', 'KETUA', 'SEKRETARIS', 'BENDAHARA', 'PEMBINA', 'PENGAWAS']}>
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
