import React, { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, Link } from 'react-router-dom';
import { auth } from './services/auth';
import { apiRequest } from './services/api';
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
import { ChangePasswordPage } from './pages/ChangePasswordPage';

const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;
const ACTIVITY_STORAGE_KEY = 'qfa_last_activity';

function SessionInactivityGuard() {
  const loggingOut = useRef(false);

  useEffect(() => {
    if (!auth.token()) return undefined;

    const now = Date.now();
    if (!localStorage.getItem(ACTIVITY_STORAGE_KEY)) {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
    }
    let lastWrite = Number(localStorage.getItem(ACTIVITY_STORAGE_KEY)) || now;

    const recordActivity = () => {
      if (!auth.token() || loggingOut.current) return;
      const current = Date.now();
      // Throttle writes while still synchronizing activity across same-browser tabs.
      if (current - lastWrite >= 1000) {
        lastWrite = current;
        localStorage.setItem(ACTIVITY_STORAGE_KEY, String(current));
      }
    };

    const checkInactivity = () => {
      if (!auth.token() || loggingOut.current) return;
      const lastActivity = Number(localStorage.getItem(ACTIVITY_STORAGE_KEY)) || lastWrite;
      if (Date.now() - lastActivity < INACTIVITY_LIMIT_MS) return;

      loggingOut.current = true;
      const role = String(auth.user()?.role || '').trim().toLowerCase() === 'client'
        ? 'client'
        : 'freelancer';
      // Notify the API when possible, then always clear the local session.
      apiRequest('/auth/logout', { method: 'POST' })
        .catch(() => {})
        .finally(() => {
          auth.clear();
          localStorage.removeItem(ACTIVITY_STORAGE_KEY);
          window.location.replace('/#/login?role=' + role + '&reason=inactive');
        });
    };

    const activityEvents = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
    window.addEventListener('storage', checkInactivity);
    const interval = window.setInterval(checkInactivity, 1000);

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      window.removeEventListener('storage', checkInactivity);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}

class PortalErrorBoundary extends React.Component {
 constructor(props){super(props);this.state={failed:false};}
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error){console.error('QFA portal render error:',error);}
 render(){return this.state.failed?<main className="portal-fatal-error"><section><h1>We could not display your workspace</h1><p>A page component encountered an error. Your account credentials are not necessarily the cause.</p><button onClick={()=>window.location.reload()}>Try again</button> <Link to="/login">Return to sign in</Link></section></main>:this.props.children;}
}
function Protected({children}){if(!auth.isValid())return <Navigate to="/login?role=freelancer" replace/>;const role=String(auth.user()?.role||'').trim().toLowerCase();if(role==='client')return <Navigate to="/client-portal" replace/>;if(role!=='freelancer')return <Navigate to="/login?role=freelancer" replace/>;return children;}
function RouteFallback(){const role=String(auth.user()?.role||'').trim().toLowerCase()==='client'?'client':'freelancer';return <Navigate to={`/login?role=${role}`} replace/>;}
function ClientProtected({children}){if(!auth.isValid())return <Navigate to="/login?role=client" replace/>;const role=String(auth.user()?.role||'').trim().toLowerCase();if(role!=='client')return <Navigate to="/login?role=client" replace/>;return <PortalErrorBoundary>{children}</PortalErrorBoundary>;}
export default function App(){return <><SessionInactivityGuard/><PortalErrorBoundary><Routes><Route path="/" element={<PublicHome/>}/><Route path="/login" element={<LoginPage/>}/><Route path="/client-portal" element={<ClientProtected><ClientPortalPage/></ClientProtected>}/><Route element={<Protected><AppShell/></Protected>}><Route path="/dashboard" element={<DashboardPage/>}/><Route path="/clients" element={<ClientsPage/>}/><Route path="/time-logs" element={<TimeLogsPage/>}/><Route path="/schedule" element={<SchedulePage/>}/><Route path="/reports" element={<ReportsPage/>}/><Route path="/fixed-invoices" element={<FixedInvoicesPage/>}/><Route path="/invoices" element={<InvoicesPage/>}/><Route path="/contracts" element={<ContractsPage/>}/><Route path="/projects" element={<ProjectsPage/>}/><Route path="/portfolio" element={<PortfolioPage/>}/><Route path="/notes" element={<NotesPage/>}/><Route path="/change-password" element={<ChangePasswordPage/>}/></Route><Route path="*" element={<RouteFallback/>}/></Routes></PortalErrorBoundary></>;}
