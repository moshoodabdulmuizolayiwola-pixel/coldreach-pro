import React, { useState, useEffect } from 'react';

interface Account {
  id: number;
  email: string;
  stage: number;
  reputation_score: number;
  target_send: number;
  sent_count: number;
  spam_rate: number;
  delivery_count: number;
  inbox_rate: number;
  reversed_count: number;
  reply_rate: number;
  is_warming_up: boolean;
  send_interval_seconds: number;
}

interface AutoSendViewProps {
  campaign: { subject: string; body: string };
}

const AutoSendView: React.FC<AutoSendViewProps> = ({ campaign }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [globalInterval, setGlobalInterval] = useState(300); // Default 5 minutes
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchAccounts();
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchAccounts, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAccount = async (id: number, field: keyof Account, value: number) => {
    const updatedAccounts = accounts.map(acc => 
      acc.id === id ? { ...acc, [field]: value } : acc
    );
    setAccounts(updatedAccounts);

    const account = updatedAccounts.find(a => a.id === id);
    if (!account) return;

    try {
      await fetch(`/api/accounts/${id}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_send: account.target_send,
          send_interval_seconds: account.send_interval_seconds
        })
      });
    } catch (error) {
      console.error('Failed to update account settings:', error);
    }
  };

  const applyGlobalInterval = async () => {
    const updatedAccounts = accounts.map(acc => ({ ...acc, send_interval_seconds: globalInterval }));
    setAccounts(updatedAccounts);

    for (const acc of updatedAccounts) {
      await fetch(`/api/accounts/${acc.id}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_send: acc.target_send,
          send_interval_seconds: globalInterval
        })
      });
    }
    alert('Global interval applied to all accounts.');
  };

  const getLifespanStatus = (reputation: number, spamRate: number) => {
    if (reputation > 75 && spamRate < 5) return { label: 'Strong', color: 'bg-emerald-100 text-emerald-700' };
    if (reputation >= 40 && spamRate < 15) return { label: 'Average', color: 'bg-amber-100 text-amber-700' };
    return { label: 'Weak', color: 'bg-rose-100 text-rose-700' };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Auto-Send View</h2>
        <p className="text-slate-500 mt-2 font-medium">Manage your automated sending limits and monitor reputation metrics across all connected accounts.</p>
      </div>

      {/* Global Tools */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-end justify-between">
        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Global Sending Interval (Seconds)</label>
          <p className="text-xs text-slate-400 mb-3">Set the rest time between each email send to prevent getting banned by Gmail algorithms.</p>
          <div className="flex items-center gap-4">
            <input 
              type="number" 
              value={globalInterval}
              onChange={(e) => setGlobalInterval(Number(e.target.value))}
              className="w-32 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition"
              min="60"
            />
            <button 
              onClick={applyGlobalInterval}
              className="bg-slate-900 text-white px-6 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow-md"
            >
              Apply to All
            </button>
          </div>
        </div>
        <div className="w-full md:w-auto mt-4 md:mt-0">
          <button 
            onClick={async () => {
              setIsSending(true);
              try {
                // This is a simplified example. In a real app, you'd iterate over accounts and send emails.
                for (const acc of accounts) {
                  // Assuming you have a way to get the recipient list.
                  // For now, I'm using a placeholder recipient.
                  await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      accountId: acc.id,
                      to: 'recipient@example.com', // This should come from your campaign data
                      subject: campaign.subject,
                      body: campaign.body
                    })
                  });
                }
                alert('Campaign sending started!');
              } catch (error) {
                console.error('Failed to start campaign:', error);
                alert('Failed to start campaign.');
              } finally {
                setIsSending(false);
              }
            }}
            disabled={isSending}
            className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-xl text-sm font-black hover:bg-blue-700 transition shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSending ? 'Working...' : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Start Sending Campaign
              </>
            )}
          </button>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-2xl shadow-slate-100/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-6 py-5">Gmail Account</th>
                <th className="px-6 py-5">Target Send</th>
                <th className="px-6 py-5">Sent</th>
                <th className="px-6 py-5">Spam Rate</th>
                <th className="px-6 py-5">Delivery</th>
                <th className="px-6 py-5">Inbox Rate</th>
                <th className="px-6 py-5">Reply Rate</th>
                <th className="px-6 py-5">Reversed</th>
                <th className="px-6 py-5">Lifespan Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-bold">
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                    No accounts connected. Go to Settings to connect Gmail accounts.
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 text-slate-900 font-medium">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${acc.is_warming_up ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                        {acc.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <input 
                        type="number" 
                        value={acc.target_send}
                        onChange={(e) => handleUpdateAccount(acc.id, 'target_send', Number(e.target.value))}
                        className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition"
                        min="1"
                      />
                    </td>
                    <td className="px-6 py-4 text-blue-600">{acc.sent_count}</td>
                    <td className="px-6 py-4 text-rose-500">{acc.spam_rate}%</td>
                    <td className="px-6 py-4 text-emerald-600">{acc.delivery_count}</td>
                    <td className="px-6 py-4 text-emerald-600">{acc.inbox_rate}%</td>
                    <td className="px-6 py-4 text-blue-600">{acc.reply_rate || 0}%</td>
                    <td className="px-6 py-4 text-amber-600">{acc.reversed_count}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getLifespanStatus(acc.reputation_score, acc.spam_rate).color}`}>
                        {getLifespanStatus(acc.reputation_score, acc.spam_rate).label}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AutoSendView;
