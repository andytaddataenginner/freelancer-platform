import { Navigate, Route, Routes } from 'react-router-dom';
import { auth } from './services/auth';
import { LoginPage } from './pages/LoginPage';
import { PublicHome } from './pages/PublicHome';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { ModulePlaceholder } from './pages/ModulePlaceholder';
import { ClientPortalPage } from './pages/ClientPortalPage';

function Protected({ children }) {
  if (!auth.isValid()) return <Navigate to="/login" replace />;
  const user = auth.user();
  if (user?.role && user.role !== 'freelancer') return <Navigate to="/client-portal" replace />;
  return children;
}

const modules = [
  ['clients', 'Clients', 'Manage client profiles, pricing models and account status.'],
  ['time-logs', 'Time Logs', 'Track billable work, review entries and manage payment status.'],
  ['schedule', 'Schedule', 'Manage bookings, availability and live work sessions.'],
  ['reports', 'Reports', 'Review revenue, utilization and client performance.'],
  ['fixed-invoices', 'Fixed Invoices', 'Manage monthly fixed-fee invoices and payment status.'],
  ['contracts', 'Contracts', 'Review contract history, pauses, resumptions and terminations.'],
  ['portfolio', 'Portfolio', 'Manage the public QFA portfolio and project entries.'],
  ['projects', 'Projects', 'Track projects, tasks and delivery progress.'],
];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicHome />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/client-portal" element={auth.isValid() && auth.user()?.role === "client" ? <ClientPortalPage /> : <Navigate to="/login" replace />} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        {modules.map(([path, title, description]) => (
          <Route key={path} path={`/${path}`} element={<ModulePlaceholder title={title} description={description} />} />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}