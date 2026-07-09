import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { EvaluationPage } from '../../features/evaluation/EvaluationPage';
import { LoginPage } from '../../features/auth/LoginPage';
import { AppShell } from '../../shared/components/AppShell';
import { SubmissionPage } from '../../features/student/SubmissionPage';
import { EvaluatorDashboard } from '../../features/evaluator/EvaluatorDashboard';
import { ReviewPage } from '../../features/evaluator/components/ReviewPage';
import { AdminDashboard } from '../../features/admin/AdminDashboard';
import { AssignmentPanel } from '../../features/admin/components/AssignmentPanel';
import { ReviewCeishPage } from '../../features/evaluator/components/ReviewCeishPage';

function RootRedirect() {
  const currentUser = useAuthStore((s) => s.currentUser);
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role === 'student') return <Navigate to="/estudiante" replace />;
  if (currentUser.role === 'evaluator') return <Navigate to="/evaluador" replace />;
  return <Navigate to="/admin" replace />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />

        {/* Full-screen evaluation routes (existing + review) */}
        <Route path="/evaluacion" element={<EvaluationPage />} />
        <Route path="/evaluacion/:id" element={<EvaluationPage />} />
        <Route path="/evaluador/revision/:submissionId" element={<ReviewPage />} />
        <Route path="/evaluador/revision-ceish/:investigacionId" element={<ReviewCeishPage />} />

        {/* Dashboard routes wrapped in AppShell */}
        <Route element={<AppShell />}>
          <Route path="/estudiante" element={<SubmissionPage />} />
          <Route path="/evaluador" element={<EvaluatorDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/asignaciones" element={<AssignmentPanel />} />
        </Route>

        {/* Root redirect */}
        <Route path="/" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
