
import React, { useState } from 'react';
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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  
  // Modal Form State
  const [newProvider, setNewProvider] = useState({
    name: 'Google',
    clientId: '',
    clientSecret: ''
  });

  const PAYSTACK_PUBLIC_KEY = 'pk_test_d810687c8c01e0a7c4ec5e1e272ef55cbc9f93d9';

  const daysRemaining = user.subscriptionExpiry 
    ? Math.max(0, Math.ceil((new Date(user.subscriptionExpiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const handleInstallProvider = () => {
    if (!newProvider.clientId || !newProvider.clientSecret) return;

    const provider: OAuthProvider = {
      id: Math.random().toString(36).substr(2, 9),
      name: newProvider.name,
      clientId: newProvider.clientId,
      clientSecret: newProvider.clientSecret,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    const updatedProviders = [...(user.authProviders || []), provider];
    onUpdateUser({ authProviders: updatedProviders });
    
    // Reset and close
    setNewProvider({ name: 'Google', clientId: '', clientSecret: '' });
    setIsAuthModalOpen(false);
  };

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
        <div className="flex justify-between items-center mb-8">
           <h2 className="text-2xl font-black text-slate-900 tracking-tight">Connected Accounts</h2>
           {plan === PlanStatus.PAID && (
             <button 
               onClick={() => setIsAuthModalOpen(true)}
               className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition"
             >
               + Connect Provider
             </button>
           )}
        </div>
        {plan === PlanStatus.FREE ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] p-20 text-center">
            <div className="text-5xl mb-8 grayscale opacity-30">🔐</div>
            <h4 className="text-xl font-black text-slate-800 mb-3">Professional Feature Locked</h4>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest text-[10px] mb-10 max-w-xs mx-auto">Connect multiple accounts to bypass daily sending limits.</p>
            <button onClick={handleUpgradeToPro} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl hover:bg-slate-800 transition">Unlock Pro Now</button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-2xl shadow-slate-100/50">
             <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                  <th className="px-10 py-6">Provider / ID</th>
                  <th className="px-10 py-6">Client ID</th>
                  <th className="px-10 py-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px] font-bold">
                {(!user.authProviders || user.authProviders.length === 0) ? (
                  <tr>
                    <td colSpan={3} className="px-10 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">No OAuth providers installed yet.</td>
                  </tr>
                ) : (
                  user.authProviders.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="px-10 py-8 text-slate-900 flex items-center gap-3">
                         <span className={`w-2.5 h-2.5 rounded-full ${p.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                         {p.name} Integration
                      </td>
                      <td className="px-10 py-8 text-slate-400 uppercase tracking-widest font-black truncate max-w-[200px]">{p.clientId}</td>
                      <td className="px-10 py-8">
                         <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Verified</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
             </table>
          </div>
        )}
      </section>

      {/* MODAL: Install Authentication Provider (As per screenshot) */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAuthModalOpen(false)} />
          
          {/* THE MODAL CONTAINER */}
          <div className="relative bg-white w-full max-w-md rounded-lg shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <h3 className="text-lg font-medium text-slate-700 mb-6">Install authentication provider</h3>
            <div className="h-[1px] bg-slate-100 -mx-6 mb-6"></div>

            <div className="space-y-6">
              {/* Provider Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-0.5">Provider</label>
                <div className="relative">
                  <select 
                    value={newProvider.name}
                    onChange={(e) => setNewProvider({...newProvider, name: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 outline-none appearance-none cursor-pointer hover:border-slate-400 transition"
                  >
                    <option value="Google">Google</option>
                    <option value="Outlook">Outlook</option>
                    <option value="SMTP">Custom SMTP</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Client ID Field (Focused with Cyan Border like screenshot) */}
              <div>
                <input 
                  type="text"
                  placeholder=""
                  value={newProvider.clientId}
                  onChange={(e) => setNewProvider({...newProvider, clientId: e.target.value})}
                  className="w-full bg-white border-2 border-[#70f3f3] rounded-md px-3 py-2 text-sm text-slate-800 outline-none shadow-[0_0_0_1px_rgba(112,243,243,0.3)]"
                  autoFocus
                />
              </div>

              {/* Client Secret Field */}
              <div>
                <input 
                  type="password"
                  placeholder="Secret"
                  value={newProvider.clientSecret}
                  onChange={(e) => setNewProvider({...newProvider, clientSecret: e.target.value})}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none hover:border-slate-400 transition focus:border-slate-400"
                />
              </div>

              {/* Buttons Area */}
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={handleInstallProvider}
                  disabled={!newProvider.clientId || !newProvider.clientSecret}
                  className="bg-[#70f3f3] text-slate-800 px-6 py-2 rounded-md text-sm font-medium hover:brightness-95 transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                >
                  Install
                </button>
                <button 
                  onClick={() => setIsAuthModalOpen(false)}
                  className="bg-[#eef1f5] text-slate-700 px-6 py-2 rounded-md text-sm font-medium hover:bg-[#e4e7eb] transition active:scale-[0.98]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
