import { Navigate, Route, Routes } from 'react-router-dom';
import { auth } from './services/auth';
import { LoginPage } from './pages/LoginPage';
import { PublicHome } from './pages/PublicHome';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { ClientPortalPage } from './pages/ClientPortalPage';
import { ClientsPage } from './pages/ClientsPage';
import { TimeLogsPage } from './pages/TimeLogsPage';
import { SchedulePage } from './pages/SchedulePage';
import { ReportsPage } from './pages/ReportsPage';
import { FixedInvoicesPage } from './pages/FixedInvoicesPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { ContractsPage } from './pages/ContractsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { NotesPage } from './pages/NotesPage';

function Protected({ children }) {
  if (!auth.isValid()) return <Navigate to="/login" replace />;
  const user = auth.user();
  if (user?.role && String(user.role).toLowerCase() !== 'freelancer') return <Navigate to="/client-portal" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicHome />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/client-portal" element={auth.isValid() && String(auth.user()?.role || '').toLowerCase() === 'client' ? <ClientPortalPage /> : <Navigate to="/login" replace />} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/time-logs" element={<TimeLogsPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/fixed-invoices" element={<FixedInvoicesPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/notes" element={<NotesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}