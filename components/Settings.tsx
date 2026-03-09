
import React, { useState, useEffect } from 'react';
import { PlanStatus, User, OAuthProvider } from '../types.ts';

declare global {
  interface Window {
    PaystackPop: any;
  }
}

interface SettingsProps {
  plan: PlanStatus;
  setPlan: (plan: PlanStatus) => void;
  user: User;
  onRefresh: () => void;
  onUpdateUser: (updates: Partial<User>) => void;
}

const Settings: React.FC<SettingsProps> = ({ plan, setPlan, user, onRefresh, onUpdateUser }) => {
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Modal Form State
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
        // Also update user.authProviders to keep it in sync for the limit check
        const providers = data.map((acc: any) => ({
          id: acc.id.toString(),
          name: acc.email,
          clientId: '',
          clientSecret: '',
          status: acc.is_warming_up ? 'active' : 'idle',
          createdAt: new Date().toISOString()
        }));
        onUpdateUser({ authProviders: providers });
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  };

  // Listen for OAuth success message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        fetchAccounts();
      }
    };
    window.addEventListener('message', handleMessage);
    
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('oauth_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
          fetchAccounts();
        }
      };
    } catch (e) {
      console.error('BroadcastChannel not supported', e);
    }
    
    return () => {
      window.removeEventListener('message', handleMessage);
      if (bc) bc.close();
    };
  }, []);

  const PAYSTACK_PUBLIC_KEY = 'pk_test_d810687c8c01e0a7c4ec5e1e272ef55cbc9f93d9';

  const daysRemaining = user.subscriptionExpiry 
    ? Math.max(0, Math.ceil((new Date(user.subscriptionExpiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const handleUpgradeToPro = () => {
    if (!window.PaystackPop) {
      alert("Billing gateway still loading. Please wait a moment.");
      return;
    }

    try {
      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: user.email,
        amount: 700000,
        currency: 'NGN',
        metadata: {
          user_id: user.id,
          plan: "PRO_ELITE",
          interval: "monthly"
        },
        callback: (response: any) => {
          setIsVerifying(true);
          setTimeout(() => {
            alert("Payment processed! Our system is syncing your status. Click 'Refresh Account' in a few seconds.");
          }, 1000);
        },
        onClose: () => {}
      });
      handler.openIframe();
    } catch (err) {
      alert("Failed to initiate payment. Please check your internet connection.");
    }
  };

  return (
    <div className="space-y-12 pb-24">
      <section>
        <div className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Billing & Plans</h2>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest text-[10px]">Monthly Professional Outreach</p>
          </div>
          {(isVerifying || (plan === PlanStatus.PAID && daysRemaining > 0)) && (
             <div className="flex items-center gap-4 bg-amber-50 px-6 py-4 rounded-[1.5rem] border border-amber-100 shadow-xl shadow-amber-50/50">
               <div className="flex flex-col">
                  <span className="text-[10px] text-amber-600 font-black uppercase tracking-widest">
                    {isVerifying ? 'Verifying...' : 'Active Subscription'}
                  </span>
                  <span className="text-xs font-black text-amber-900 uppercase tracking-widest">
                    Expires in {daysRemaining} days
                  </span>
               </div>
               <button onClick={onRefresh} className="bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-200 hover:bg-amber-700 transition">Refresh Account</button>
             </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className={`p-10 border-2 rounded-[2.5rem] transition-all duration-300 ${plan === PlanStatus.FREE ? 'border-blue-500 bg-white shadow-2xl shadow-blue-50' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest mb-10">Base</h3>
            <div className="mb-10">
               <span className="text-5xl font-black text-slate-900 tracking-tighter">₦0</span>
               <span className="text-slate-400 text-xs font-black ml-2 uppercase tracking-widest">/ Month</span>
            </div>
            <ul className="space-y-5 mb-12 text-sm font-bold text-slate-600">
              <li className="flex items-center gap-3"><span className="text-emerald-500 font-black">✓</span> Manual Gmail Mode</li>
              <li className="flex items-center gap-3"><span className="text-emerald-500 font-black">✓</span> 50 Monthly Leads</li>
              <li className="flex items-center gap-3 text-slate-300 line-through"><span>✗</span> Discovery Engine</li>
              <li className="flex items-center gap-3 text-slate-300 line-through"><span>✗</span> Multi-Account Cloud</li>
            </ul>
            <button disabled={plan === PlanStatus.FREE} className="w-full py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition bg-slate-900 text-white disabled:bg-slate-50 disabled:text-slate-300">
              {plan === PlanStatus.FREE ? 'Current Plan' : 'Standard Access'}
            </button>
          </div>

          <div className={`p-10 border-2 rounded-[2.5rem] relative overflow-hidden transition-all duration-300 ${plan === PlanStatus.PAID ? 'border-amber-500 bg-white shadow-2xl shadow-amber-50' : 'border-slate-100 bg-white shadow-2xl shadow-slate-200/40'}`}>
            <div className="absolute top-0 right-0">
               <div className="bg-amber-600 text-white text-[9px] font-black px-6 py-2.5 rounded-bl-3xl uppercase tracking-[0.2em]">Elite Access</div>
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest mb-10">Pro Elite</h3>
            <div className="mb-10">
               <span className="text-5xl font-black text-slate-900 tracking-tighter">₦7,000</span>
               <span className="text-slate-400 text-xs font-black ml-2 uppercase tracking-widest">/ Month</span>
            </div>
            <ul className="space-y-5 mb-12 text-sm font-black text-slate-800">
              <li className="flex items-center gap-3"><span className="text-amber-500">✨</span> Cloud Discovery Engine</li>
              <li className="flex items-center gap-3"><span className="text-amber-500">✨</span> n8n Cloud Automation</li>
              <li className="flex items-center gap-3"><span className="text-amber-500">✨</span> Multi-Gmail Rotating</li>
              <li className="flex items-center gap-3"><span className="text-amber-500">✨</span> Advanced Personalization</li>
            </ul>
            <button 
              disabled={isVerifying}
              onClick={handleUpgradeToPro}
              className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition shadow-2xl ${
                plan === PlanStatus.PAID 
                ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
              }`}
            >
              {plan === PlanStatus.PAID ? (daysRemaining <= 5 ? 'Renew Subscription' : '✓ Elite Active') : 'Upgrade to Elite'}
            </button>
          </div>
        </div>
      </section>

      {/* Inbox Management Section */}
      <section>
        <div className="flex justify-between items-center mb-4">
           <div>
             <h2 className="text-2xl font-black text-slate-900 tracking-tight">Connected Accounts</h2>
             <p className="text-slate-500 text-sm font-bold mt-1">Connect your Gmail accounts to enable automated sending and warm-up features. You can connect up to 2,000 accounts.</p>
           </div>
           <button 
             onClick={async () => {
               try {
                 const redirectUri = `${window.location.origin}/oauth2callback`;
                 const response = await fetch(`/api/auth/url?redirect_uri=${encodeURIComponent(redirectUri)}`);
                 if (!response.ok) throw new Error(`Failed to get auth URL: ${response.status} ${response.statusText}`);
                 const { url } = await response.json();
                 
                 const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
                 if (!authWindow) {
                   alert('Please allow popups for this site to connect your account.');
                   return;
                 }
               } catch (err: any) {
                 console.error('Failed to open auth window', err);
                 alert(`Failed to connect: ${err.message || 'Unknown error'}. Please try again.`);
               }
             }}
             disabled={(user.authProviders?.length || 0) >= 2000}
             className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition flex-shrink-0 ${
               (user.authProviders?.length || 0) >= 2000 
                 ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                 : 'bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700'
             }`}
           >
             { (user.authProviders?.length || 0) >= 2000 ? 'Limit Reached (2000)' : '+ Connect Gmail' }
           </button>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-2xl shadow-slate-100/50 mt-8">
           <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-10 py-6">Email Address</th>
                <th className="px-10 py-6">Status</th>
                <th className="px-10 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px] font-bold">
              {(!user.authProviders || user.authProviders.length === 0) ? (
                <tr>
                  <td colSpan={3} className="px-10 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">No Gmail accounts connected yet.</td>
                </tr>
              ) : (
                user.authProviders.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="px-10 py-8 text-slate-900 font-medium">
                       {p.name}
                    </td>
                    <td className="px-10 py-8">
                       <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${p.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                         {p.status === 'active' ? 'Warming Up' : 'Idle'}
                       </span>
                    </td>
                    <td className="px-10 py-8 text-right space-x-3">
                       <button 
                         onClick={() => {
                           // Toggle warmup status
                           const updatedProviders = user.authProviders?.map(provider => 
                             provider.id === p.id ? { ...provider, status: provider.status === 'active' ? 'idle' : 'active' } : provider
                           );
                           onUpdateUser({ authProviders: updatedProviders });
                           fetch(`/api/accounts/${p.id}/warmup`, {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({ is_warming_up: p.status !== 'active' })
                           });
                         }}
                         className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${p.status === 'active' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                       >
                         {p.status === 'active' ? 'Stop Warmup' : 'Start Warmup'}
                       </button>
                       <button 
                         onClick={() => {
                           // Remove account
                           const updatedProviders = user.authProviders?.filter(provider => provider.id !== p.id);
                           onUpdateUser({ authProviders: updatedProviders });
                           fetch(`/api/accounts/${p.id}`, { method: 'DELETE' });
                         }}
                         className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition"
                       >
                         Sign Out
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
           </table>
        </div>
      </section>
    </div>
  );
};

export default Settings;
