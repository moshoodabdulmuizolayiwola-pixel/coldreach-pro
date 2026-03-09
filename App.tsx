
import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { PlanStatus, Lead, LeadStatus, User } from './types.ts';

// Lazy load components to improve initial load time
const Sidebar = lazy(() => import('./components/Sidebar.tsx'));
const Dashboard = lazy(() => import('./components/Dashboard.tsx'));
const LeadManagement = lazy(() => import('./components/LeadManagement.tsx'));
const CampaignBuilder = lazy(() => import('./components/CampaignBuilder.tsx'));
const ManualSender = lazy(() => import('./components/ManualSender.tsx'));
const AutoSendView = lazy(() => import('./components/AutoSendView.tsx'));
const Settings = lazy(() => import('./components/Settings.tsx'));
const LandingPage = lazy(() => import('./components/LandingPage.tsx'));
const AuthForms = lazy(() => import('./components/AuthForms.tsx'));

const BASE_STORAGE_KEYS = {
  HAS_ENTERED: 'cr_pro_session_active_v2',
  USER_SESSION: 'cr_pro_auth_user_v2',
  GLOBAL_PLAN: 'cr_pro_plan_status_v2'
};

const App: React.FC = () => {
  // 1. Core Auth State - Initializes immediately from device storage
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(BASE_STORAGE_KEYS.USER_SESSION);
    return saved ? JSON.parse(saved) : null;
  });

  // 2. Navigation & UI State
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('cr_pro_active_tab_v2') || 'dashboard';
  });
  
  // Auto-skip landing if user session is active on this device
  const [showLanding, setShowLanding] = useState(() => {
    const sessionActive = localStorage.getItem(BASE_STORAGE_KEYS.HAS_ENTERED) === 'true';
    const userStored = !!localStorage.getItem(BASE_STORAGE_KEYS.USER_SESSION);
    return !(sessionActive && userStored);
  });

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(() => {
    return localStorage.getItem('cr_app_installed') === 'true' || 
           window.matchMedia('(display-mode: standalone)').matches || 
           (window.navigator as any).standalone;
  });

  // 3. User-Specific Data State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaign, setCampaign] = useState({ subject: '', body: '' });
  const [userPlan, setUserPlan] = useState<PlanStatus>(PlanStatus.FREE);

  // --- PERSISTENCE ENGINE ---

  // Load user data whenever currentUser changes
  useEffect(() => {
    if (currentUser) {
      const userId = currentUser.id;
      
      const savedLeads = localStorage.getItem(`cr_leads_${userId}`);
      setLeads(savedLeads ? JSON.parse(savedLeads) : []);
      
      const savedCampaign = localStorage.getItem(`cr_campaign_${userId}`);
      setCampaign(savedCampaign ? JSON.parse(savedCampaign) : { subject: '', body: '' });
      
      const savedPlan = localStorage.getItem(`cr_plan_${userId}`);
      setUserPlan((savedPlan as PlanStatus) || PlanStatus.FREE);
      
      // Save session markers to device
      localStorage.setItem(BASE_STORAGE_KEYS.USER_SESSION, JSON.stringify(currentUser));
      localStorage.setItem(BASE_STORAGE_KEYS.HAS_ENTERED, 'true');
    }
  }, [currentUser]);

  // Save data specifically for the current user
  useEffect(() => {
    if (currentUser) {
      // Debounce the heavy JSON.stringify operation to prevent app hanging during rapid auto-clicking
      const timer = setTimeout(() => {
        localStorage.setItem(`cr_leads_${currentUser.id}`, JSON.stringify(leads));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [leads, currentUser]);

  useEffect(() => {
    if (currentUser) {
      const timer = setTimeout(() => {
        localStorage.setItem(`cr_campaign_${currentUser.id}`, JSON.stringify(campaign));
        localStorage.setItem(`cr_plan_${currentUser.id}`, userPlan);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [campaign, userPlan, currentUser]);

  useEffect(() => {
    localStorage.setItem('cr_pro_active_tab_v2', activeTab);
  }, [activeTab]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    const handleAppInstalled = () => {
      setIsInstalled(true);
      localStorage.setItem('cr_app_installed', 'true');
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // --- ACTIONS ---

  const handleEnterPlatform = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setShowLanding(false);
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setShowLanding(false);
  };

  const handleUpdateUser = (updates: Partial<User>) => {
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      setCurrentUser(updatedUser);
      const users: User[] = JSON.parse(localStorage.getItem('cr_users') || '[]');
      const index = users.findIndex(u => u.id === updatedUser.id);
      if (index !== -1) {
        users[index] = updatedUser;
        localStorage.setItem('cr_users', JSON.stringify(users));
      }
    }
  };

  const handleExitDashboard = () => {
    localStorage.removeItem(BASE_STORAGE_KEYS.HAS_ENTERED);
    localStorage.removeItem(BASE_STORAGE_KEYS.USER_SESSION);
    setCurrentUser(null);
    setShowLanding(true);
    setAuthMode('login');
  };

  const clearAllLeads = useCallback(() => {
    setLeads([]);
  }, []);

  const updateLeadStatus = (id: string, status: LeadStatus) => {
    setLeads(prev => prev.map(l => l.id === id ? { 
      ...l, 
      status,
      sentAt: status === LeadStatus.SENT ? new Date().toISOString() : l.sentAt
    } : l));
  };

  if (showLanding) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
        <LandingPage onEnter={handleEnterPlatform} />
      </Suspense>
    );
  }

  if (!currentUser) {
    return (
      <div className="relative">
        <button 
          onClick={() => setShowLanding(true)}
          className="fixed top-6 left-6 z-[200] bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition flex items-center gap-2 shadow-sm"
        >
          ← Return to Home
        </button>
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
          <AuthForms initialMode={authMode} onAuthSuccess={handleAuthSuccess} onNavigate={() => {}} />
        </Suspense>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard plan={userPlan} leads={leads} user={currentUser} />;
      case 'leads':
        return <LeadManagement leads={leads} setLeads={setLeads} onClearLeads={clearAllLeads} user={currentUser} plan={userPlan} />;
      case 'campaigns':
        return <CampaignBuilder plan={userPlan} campaign={campaign} setCampaign={setCampaign} />;
      case 'manual-send':
        return <ManualSender leads={leads} campaign={campaign} onStatusUpdate={updateLeadStatus} user={currentUser} />;
      case 'auto-send':
        return <AutoSendView campaign={campaign} />;
      case 'settings':
        return <Settings plan={userPlan} setPlan={setUserPlan} user={currentUser} onRefresh={() => {}} onUpdateUser={handleUpdateUser} />;
      default:
        return <Dashboard plan={userPlan} leads={leads} user={currentUser} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      {/* Download App Floating Button (Mobile/Tablet only) */}
      {!isInstalled && (
        <div className="lg:hidden fixed top-20 right-4 z-[100] flex items-center gap-1">
          <button 
            onClick={async () => {
              if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                  setDeferredPrompt(null);
                  setIsInstalled(true);
                  localStorage.setItem('cr_app_installed', 'true');
                }
              } else {
                alert("App is ready to install! Tap your browser menu (3 dots) and select 'Install App' or 'Add to Home Screen'.");
              }
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-xl text-xs font-bold flex items-center gap-2 animate-bounce"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Download App
          </button>
          <button 
            onClick={() => {
              setIsInstalled(true);
              localStorage.setItem('cr_app_installed', 'true');
            }}
            className="bg-white text-slate-400 hover:text-slate-600 p-1.5 rounded-full shadow-xl border border-slate-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      )}

      {/* Mobile Top Nav */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-[60]">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm">C</div>
          <span className="text-lg font-black tracking-tight">ColdReach</span>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600 bg-slate-50 rounded-xl">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16m-7 6h7"></path>
          </svg>
        </button>
      </div>

      <Suspense fallback={<div className="flex items-center justify-center h-screen w-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={(tab) => { setActiveTab(tab); setIsSidebarOpen(false); }} 
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onExit={handleExitDashboard}
          user={currentUser}
        />
        
        <main className="flex-1 p-4 lg:p-10 pt-24 lg:pt-10 overflow-y-auto max-h-screen">
          <div className="max-w-6xl mx-auto">
            <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
              {renderContent()}
            </Suspense>
          </div>
        </main>
      </Suspense>
      
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[90] lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
    </div>
  );
};

export default App;
