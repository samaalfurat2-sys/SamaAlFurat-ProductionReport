import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Entry from "@/pages/Entry";
import Records from "@/pages/Records";
import Accounting from "@/pages/Accounting";
import Auditor from "@/pages/Auditor";
import WH2Approvals from "@/pages/WH2Approvals";
import WH3Approvals from "@/pages/WH3Approvals";
import Orders from "@/pages/Orders";
import Settings from "@/pages/Settings";
import CloseProduction from "@/pages/CloseProduction";
import InventorySetup from "@/pages/InventorySetup";
import GoLiveChecklist from "@/pages/GoLiveChecklist";
import Warehouse4Diesel from "@/pages/Warehouse4Diesel";
import Warehouse1Report from "@/pages/Warehouse1Report";
import Warehouse2Report from "@/pages/Warehouse2Report";
import Warehouse3Report from "@/pages/Warehouse3Report";
import Warehouse4Report from "@/pages/Warehouse4Report";
import AccountingReport from "@/pages/AccountingReport";
import AuditorReport from "@/pages/AuditorReport";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import Analytics from "./pages/Analytics";
import AdminPanel from "@/pages/AdminPanel";
import NotFound from "@/pages/not-found";
import Auth from "@/pages/Auth";
import { useState, useEffect } from "react";
import { fullSync, startAutoSync, isOnline, getPendingSyncCount, onSyncStatus, type SyncStatus } from "./lib/sync";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/entry" component={Entry} />
        <Route path="/close-production" component={CloseProduction} />
        <Route path="/records" component={Records} />
        <Route path="/accounting" component={Accounting} />
        <Route path="/auditor" component={Auditor} />
        <Route path="/wh2-approvals" component={WH2Approvals} />
        <Route path="/wh3-approvals" component={WH3Approvals} />
        <Route path="/orders" component={Orders} />
        <Route path="/settings" component={Settings} />
        <Route path="/inventory-setup" component={InventorySetup} />
        <Route path="/go-live-checklist" component={GoLiveChecklist} />
        <Route path="/warehouse4-diesel" component={Warehouse4Diesel} />
        <Route path="/wh1-report" component={Warehouse1Report} />
        <Route path="/wh2-report" component={Warehouse2Report} />
        <Route path="/wh3-report" component={Warehouse3Report} />
        <Route path="/wh4-report" component={Warehouse4Report} />
        <Route path="/accounting-report" component={AccountingReport} />
        <Route path="/auditor-report" component={AuditorReport} />
        <Route path="/analytics" component={AnalyticsDashboard} />
        <Route path="/consumption-analytics" component={Analytics} />
        <Route path="/admin" component={AdminPanel} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  const [role, setRole] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [online, setOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(getPendingSyncCount());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  const SERVER_URL = (window as any).AndroidBridge?.getServerUrl?.() || '';
  const LOGOUT_URL = SERVER_URL ? `${SERVER_URL}/api/auth/logout` : '/api/auth/logout';

  useEffect(() => {
    const savedRole = localStorage.getItem('userRole');
    if (savedRole) {
      setRole(savedRole);
      try {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        setDisplayName(userData.displayName || '');
      } catch {}
    }
    fullSync().catch(() => {});
    startAutoSync();

    const handleOnline = () => { setOnline(true); setPendingCount(getPendingSyncCount()); };
    const handleOffline = () => { setOnline(false); setPendingCount(getPendingSyncCount()); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsub = onSyncStatus((status) => {
      setSyncStatus(status);
      setPendingCount(getPendingSyncCount());
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsub();
    };
  }, []);

  const handleLogin = (selectedRole: string, userData?: any) => {
    localStorage.setItem('userRole', selectedRole);
    if (userData) {
      localStorage.setItem('userData', JSON.stringify(userData));
      setDisplayName(userData.displayName || '');
    }
    setRole(selectedRole);
    fullSync().catch(() => {});
  };

  const handleLogout = async () => {
    try {
      await fetch(LOGOUT_URL, { method: 'POST', credentials: 'include' });
    } catch (_) {}
    localStorage.removeItem('userRole');
    localStorage.removeItem('userData');
    setRole(null);
    setDisplayName("");
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {!role ? (
          <Auth onLogin={handleLogin} />
        ) : (
          <div className="relative">
            {!online && (
              <div className="fixed top-0 left-0 right-0 z-[70] bg-amber-500 text-white text-center text-xs py-1 font-medium" data-testid="banner-offline">
                ⚡ Offline Mode {pendingCount > 0 ? `(${pendingCount} changes pending sync)` : '— Changes saved locally'}
              </div>
            )}
            {online && syncStatus === 'syncing' && (
              <div className="fixed top-0 left-0 right-0 z-[70] bg-blue-500 text-white text-center text-xs py-1 font-medium" data-testid="banner-syncing">
                Syncing...
              </div>
            )}
            <button
              onClick={handleLogout}
              className={`absolute ${!online || syncStatus === 'syncing' ? 'top-8' : 'top-4'} right-4 z-[60] bg-background/80 backdrop-blur text-xs px-3 py-1 rounded-full border shadow-sm font-medium flex items-center gap-2 hover:bg-muted`}
              data-testid="button-logout"
            >
              <div className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
              {displayName || (
                role === 'keeper1' ? 'WH1 Keeper' :
                role === 'keeper2' ? 'WH3 Keeper' :
                role === 'keeper3' ? 'WH4 Keeper' :
                role === 'manager' ? 'System Manager' :
                role === 'operator' ? 'Machine Operator' :
                role === 'supervisor' ? 'Shift Supervisor' :
                role.charAt(0).toUpperCase() + role.slice(1)
              )}
            </button>
            <Router />
          </div>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
