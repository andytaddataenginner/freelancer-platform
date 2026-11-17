import React from 'react';
import { Navigate, Route, Routes, Link } from 'react-router-dom';
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
import { ChatbotLoader } from './components/ChatbotLoader';
class PortalErrorBoundary extends React.Component {
 constructor(props){super(props);this.state={failed:false};}
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error){console.error('QFA portal render error:',error);}
 render(){return this.state.failed?<main className="portal-fatal-error"><section><h1>We could not display your workspace</h1><p>A page component encountered an error. Your account credentials are not necessarily the cause.</p><button onClick={()=>window.location.reload()}>Try again</button> <Link to="/login">Return to sign in</Link></section></main>:this.props.children;}
}
function Protected({children}){if(!auth.isValid())return <Navigate to="/login?role=freelancer" replace/>;const role=String(auth.user()?.role||'').trim().toLowerCase();if(role==='client')return <Navigate to="/client-portal" replace/>;if(role!=='freelancer')return <Navigate to="/login?role=freelancer" replace/>;return children;}
function RouteFallback(){const path=window.location.pathname;if(path.length>1&&path.endsWith('/'))return <Navigate to={path.slice(0,-1)+window.location.search+window.location.hash} replace/>;return <main className="route-not-found"><h1>Page not found</h1><p>The QFA page does not exist or the link is outdated.</p><Link to="/">Return to QFA home</Link></main>;}
function ClientProtected({children}){if(!auth.isValid())return <Navigate to="/login?role=client" replace/>;const role=String(auth.user()?.role||'').trim().toLowerCase();if(role!=='client')return <Navigate to="/login?role=client" replace/>;return <PortalErrorBoundary>{children}</PortalErrorBoundary>;}
export default function App(){return <PortalErrorBoundary><ChatbotLoader/><Routes><Route path="/" element={<PublicHome/>}/><Route path="/login" element={<LoginPage/>}/><Route path="/client-portal" element={<ClientProtected><ClientPortalPage/></ClientProtected>}/><Route element={<Protected><AppShell/></Protected>}><Route path="/dashboard" element={<DashboardPage/>}/><Route path="/clients" element={<ClientsPage/>}/><Route path="/time-logs" element={<TimeLogsPage/>}/><Route path="/schedule" element={<SchedulePage/>}/><Route path="/reports" element={<ReportsPage/>}/><Route path="/fixed-invoices" element={<FixedInvoicesPage/>}/><Route path="/invoices" element={<InvoicesPage/>}/><Route path="/contracts" element={<ContractsPage/>}/><Route path="/projects" element={<ProjectsPage/>}/><Route path="/portfolio" element={<PortfolioPage/>}/><Route path="/notes" element={<NotesPage/>}/></Route><Route path="*" element={<RouteFallback/>}/></Routes></PortalErrorBoundary>;}