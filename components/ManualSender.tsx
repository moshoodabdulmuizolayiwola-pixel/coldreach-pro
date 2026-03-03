
import React, { useState, useMemo, useCallback } from 'react';
import { Lead, LeadStatus, User } from '../types.ts';
import { buildGmailComposeLink } from '../services/geminiService.ts';

interface ManualSenderProps {
  leads: Lead[];
  campaign: { subject: string; body: string };
  onStatusUpdate: (id: string, status: LeadStatus) => void;
  user: User;
}

const ManualSender: React.FC<ManualSenderProps> = ({ leads, campaign, onStatusUpdate, user }) => {
  const [filter, setFilter] = useState<'all' | LeadStatus.TO_SEND | LeadStatus.SENT>('all');
  const [processingLeads, setProcessingLeads] = useState<Set<string>>(new Set());
  
  const filteredLeads = useMemo(() => 
    leads.filter(l => filter === 'all' || l.status === filter)
  , [leads, filter]);

  /**
   * Fast execution within the existing trigger flow.
   * Priority: Browser Action (Link Opening) must be immediate.
   */
  const handleSend = useCallback((lead: Lead) => {
    // Prevent double-clicks from auto-clickers
    if (processingLeads.has(lead.id)) return;
    
    setProcessingLeads(prev => new Set(prev).add(lead.id));

    // 1. Instant calculation (Synchronous)
    const outreachUrl = buildGmailComposeLink(lead, campaign.subject, campaign.body);
    
    // 2. IMMEDIATE TRIGGER: Primary action must be unblocked by any state updates
    if (outreachUrl.startsWith('mailto:')) {
      window.location.href = outreachUrl;
    } else {
      // Desktop: Open in new tab instantly
      const newWin = window.open(outreachUrl, '_blank');
      if (!newWin) window.location.href = outreachUrl; // Fallback if popup blocked
    }
    
    // 3. DEFERRED STATE: Update tracking AFTER the intent is handed to the OS/Browser
    setTimeout(() => {
      onStatusUpdate(lead.id, LeadStatus.SENT);
      
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const day = now.getDate().toString();
      const storageKey = `cr_velocity_${user.id}_${monthKey}`;
      
      try {
        const velocityLog = JSON.parse(localStorage.getItem(storageKey) || '{}');
        velocityLog[day] = (velocityLog[day] || 0) + 1;
        localStorage.setItem(storageKey, JSON.stringify(velocityLog));
      } catch (e) {
        console.error("ManualSender: Velocity tracking failed.");
      }
      
      // Remove from processing after a short delay to ensure UI updates
      setTimeout(() => {
        setProcessingLeads(prev => {
          const next = new Set(prev);
          next.delete(lead.id);
          return next;
        });
      }, 1000);
    }, 0);
  }, [campaign.subject, campaign.body, onStatusUpdate, processingLeads, user.id]);

  const handleBrowse = useCallback((lead: Lead) => {
    if (processingLeads.has(lead.id)) return;
    setProcessingLeads(prev => new Set(prev).add(lead.id));

    const url = lead.website?.startsWith('http') ? lead.website : `https://${lead.website}`;
    window.open(url, '_blank');

    setTimeout(() => {
      onStatusUpdate(lead.id, LeadStatus.SENT);
      
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const day = now.getDate().toString();
      const storageKey = `cr_velocity_${user.id}_${monthKey}`;
      
      try {
        const velocityLog = JSON.parse(localStorage.getItem(storageKey) || '{}');
        velocityLog[day] = (velocityLog[day] || 0) + 1;
        localStorage.setItem(storageKey, JSON.stringify(velocityLog));
      } catch (e) {
        console.error("ManualSender: Velocity tracking failed.");
      }
      
      setTimeout(() => {
        setProcessingLeads(prev => {
          const next = new Set(prev);
          next.delete(lead.id);
          return next;
        });
      }, 1000);
    }, 0);
  }, [onStatusUpdate, processingLeads, user.id]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Manual Sending View</h1>
          <p className="text-slate-500 text-sm font-medium">Fast-trigger outreach active.</p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter('all')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition ${filter === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>All</button>
        <button onClick={() => setFilter(LeadStatus.TO_SEND)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition ${filter === LeadStatus.TO_SEND ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Pending ({leads.filter(l => l.status === LeadStatus.TO_SEND).length})</button>
        <button onClick={() => setFilter(LeadStatus.SENT)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition ${filter === LeadStatus.SENT ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Sent ({leads.filter(l => l.status === LeadStatus.SENT).length})</button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-8 py-6">Target</th>
                <th className="px-8 py-6 hidden md:table-cell">Company</th>
                <th className="px-8 py-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium">
              {filteredLeads.length === 0 ? (
                <tr><td colSpan={3} className="px-8 py-24 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">No records match this filter</td></tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-8 py-7">
                      <p className="font-black text-slate-900">{lead.firstName} {lead.lastName}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{lead.email || lead.website}</p>
                    </td>
                    <td className="px-8 py-7 hidden md:table-cell text-slate-600 font-bold">{lead.companyName}</td>
                    <td className="px-8 py-7 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {lead.status === LeadStatus.SENT ? (
                          <span className="text-emerald-600 text-[9px] font-black uppercase bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                            {lead.email ? 'Sent at' : 'Visited at'} {formatDate(lead.sentAt)}
                          </span>
                        ) : (
                          <>
                            {lead.website && !lead.email && (
                              <button 
                                onClick={() => handleBrowse(lead)}
                                disabled={processingLeads.has(lead.id)}
                                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition active:scale-95 ${
                                  processingLeads.has(lead.id) 
                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' 
                                    : 'bg-slate-900 text-white shadow-slate-200 hover:bg-slate-800'
                                }`}
                              >
                                {processingLeads.has(lead.id) ? 'Opening...' : 'Open Browser'}
                              </button>
                            )}
                            {lead.email && (
                              <button 
                                onClick={() => handleSend(lead)} 
                                disabled={processingLeads.has(lead.id)}
                                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition active:scale-95 ${
                                  processingLeads.has(lead.id) 
                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' 
                                    : 'bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700'
                                }`}
                              >
                                {processingLeads.has(lead.id) ? 'Sending...' : 'Send Email'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
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

export default ManualSender;
