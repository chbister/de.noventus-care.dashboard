import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { EinrichtungProvider } from '@/lib/EinrichtungContext';
import Layout from '@/components/Layout';

import Dashboard from './pages/Dashboard';
import Wohnbereiche from './pages/Wohnbereiche';
import TagespflegePage from './pages/Tagespflege';
import Mitarbeiter from './pages/Mitarbeiter';
import Heimkosten from './pages/Heimkosten';
import Controlling from './pages/Controlling';
import BudgetwerteVerwalten from './pages/BudgetwerteVerwalten';
import Einstellungen from './pages/Einstellungen';
import Verguetung from './pages/Verguetung';
import BewohnerKosten from './pages/BewohnerKosten';
import Admin from './pages/Admin';
import Eingliederungshilfe from './pages/Eingliederungshilfe';
import BetreutesWohnen from './pages/BetreutesWohnen';
import BetreutesWohnenDashboard from './pages/BetreutesWohnenDashboard';
import TagespflegeDashboard from './pages/TagespflegeDashboard';
import KIAnalyse from './pages/KIAnalyse';
import Handbuch from './pages/Handbuch';
import TeamChat from './pages/TeamChat';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <EinrichtungProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/wohnbereiche" element={<Wohnbereiche />} />
          <Route path="/tagespflege" element={<TagespflegePage />} />
          <Route path="/mitarbeiter" element={<Mitarbeiter />} />
          <Route path="/heimkosten" element={<Heimkosten />} />
          <Route path="/controlling" element={<Controlling />} />
          <Route path="/budgetwerte" element={<BudgetwerteVerwalten />} />
          <Route path="/einstellungen" element={<Einstellungen />} />
          <Route path="/verguetung" element={<Verguetung />} />
          <Route path="/bewohner-kosten" element={<BewohnerKosten />} />
          <Route path="/eingliederungshilfe" element={<Eingliederungshilfe />} />
          <Route path="/betreutes-wohnen" element={<BetreutesWohnen />} />
          <Route path="/betreutes-wohnen-dashboard" element={<BetreutesWohnenDashboard />} />
          <Route path="/tagespflege-dashboard" element={<TagespflegeDashboard />} />
          <Route path="/ki-analyse" element={<KIAnalyse />} />
          <Route path="/handbuch" element={<Handbuch />} />
          <Route path="/chat" element={<TeamChat />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Layout>
    </EinrichtungProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;