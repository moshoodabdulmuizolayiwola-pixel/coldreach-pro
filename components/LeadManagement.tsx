
import React, { useState, useRef, useMemo } from 'react';
import { Lead, LeadStatus, PlanStatus, User } from '../types.ts';
import { countries as allCountries } from '../utils/countries.ts';
import { logLeadToSheets } from '../services/webhookService.ts';

interface LeadManagementProps {
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  onClearLeads: () => void;
  user: User;
  plan: PlanStatus;
}

const LeadManagement: React.FC<LeadManagementProps> = ({ leads, setLeads, onClearLeads, user, plan }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [pastedData, setPastedData] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // IMPROVEMENT 1: Duplicate Detection State
  const [duplicateEmails, setDuplicateEmails] = useState<string[]>([]);
  const [pendingImportQueue, setPendingImportQueue] = useState<Lead[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Discovery State
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [genParams, setGenParams] = useState({
    platforms: [] as string[],
    categories: [] as string[],
    countries: [] as string[],
    language: 'English',
    ads_running: false,
    business_status: 'active' as 'active' | 'inactive'
  });

  const platformsList = ['Shopify', 'Wix', 'WooCommerce', 'WordPress', 'BigCommerce', 'Etsy', 'Amazon', 'Stan', 'Magento', 'Squarespace'];
  const categoriesList = ['Fashion', 'Health & Beauty', 'Electronics', 'Home & Garden', 'SaaS', 'Digital Services', 'Real Estate', 'Automotive'];

  const filteredLeads = leads.filter(l => {
    const matchesSearch = `${l.firstName} ${l.lastName} ${l.companyName} ${l.email}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlatform = platformFilter ? l.platform === platformFilter : true;
    const matchesStatus = statusFilter ? l.status === statusFilter : true;
    return matchesSearch && matchesPlatform && matchesStatus;
  });

  /**
   * IMPROVEMENT 1: Required Core Logic
   * O(n) performance via Set lookup
   */
  const handleImportAttempt = (newLeads: Lead[]) => {
    if (newLeads.length === 0) return;

    const existingIdentifiers = new Set(leads.map(l => (l.email || l.website || '').toLowerCase()).filter(Boolean));
    const seenInBatch = new Set<string>();
    
    const duplicatesFound: string[] = [];
    const cleanLeads: Lead[] = [];

    newLeads.forEach(l => {
      const identifier = (l.email || l.website || '').toLowerCase();
      if (!identifier) return;

      if (existingIdentifiers.has(identifier) || seenInBatch.has(identifier)) {
        duplicatesFound.push(identifier);
      } else {
        cleanLeads.push(l);
        seenInBatch.add(identifier);
      }
    });

    if (duplicatesFound.length > 0) {
      setDuplicateEmails(duplicatesFound);
      setPendingImportQueue(cleanLeads);
      setShowDuplicateModal(true);
    } else {
      processImport(cleanLeads);
    }
  };

  const processImport = (leadsToSave: Lead[]) => {
    setLeads(prev => [...prev, ...leadsToSave]);
    leadsToSave.forEach(l => logLeadToSheets(l, user.id));
    setIsImportModalOpen(false);
    setPastedData('');
    setShowDuplicateModal(false);
    setDuplicateEmails([]);
    setPendingImportQueue([]);
  };

  const handleClearTrigger = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsClearing(true);
    onClearLeads();
    setSearchTerm('');
    setPlatformFilter('');
    setStatusFilter('');
    setTimeout(() => setIsClearing(false), 800);
  };

  const parseTextToLeads = (text: string): Lead[] => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const parts = line.split(/[,\t;]/).map(p => p.trim());
      if (parts.length === 1) {
        const val = parts[0];
        if (val.includes('@') && !val.includes(' ')) {
          return createLead({ email: val });
        } else if (val.match(/^(https?:\/\/)?([\da-zA-Z\.-]+)\.([a-zA-Z\.]{2,6})([\/\w \.-]*)*\/?$/)) {
          const domain = val.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
          return createLead({
            firstName: 'Store',
            lastName: 'Owner',
            companyName: domain,
            email: '',
            website: val
          });
        }
      }
      return createLead({
        firstName: parts[0] || 'User',
        lastName: parts[1] || '',
        companyName: parts[2] || 'Business',
        email: parts[3] || (parts[0].includes('@') ? parts[0] : ''),
        platform: parts[4] || 'Direct'
      });
    }).filter(l => (l.email && l.email.includes('@')) || l.website);
  };

  const createLead = (data: Partial<Lead>): Lead => ({
    id: Math.random().toString(36).substr(2, 9),
    firstName: data.firstName || 'User',
    lastName: data.lastName || '',
    companyName: data.companyName || 'Business',
    email: data.email || '',
    platform: data.platform || 'Direct',
    country: data.country || 'Unknown',
    language: 'English',
    website: data.website || '',
    socialLinks: {},
    status: LeadStatus.TO_SEND,
    createdAt: new Date().toISOString()
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleImportAttempt(parseTextToLeads(text));
    };
    reader.readAsText(file);
  };

  const handleGenerateLeadsPro = async () => {
    if (plan !== PlanStatus.PAID) {
      setGenError("PRO feature only. Please upgrade in Settings.");
      return;
    }
    setGenError('');
    setIsGenerating(true);
    try {
      const response = await fetch('https://coldreachpro.app.n8n.cloud/webhook/lead-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...genParams, user_id: user.id })
      });
      if (!response.ok) throw new Error("Cloud Discovery connection error.");
      const result = await response.json();
      if (result.leads) handleImportAttempt(result.leads);
    } catch (err: any) {
      setGenError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleParam = (key: 'platforms' | 'categories' | 'countries', value: string) => {
    setGenParams(prev => {
      const list = [...prev[key]];
      const index = list.indexOf(value);
      if (index > -1) list.splice(index, 1);
      else list.push(value);
      return { ...prev, [key]: list };
    });
  };

  const visibleCountries = allCountries.filter(c => 
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  return (
    <div className="space-y-10 pb-20">
      {/* Discovery Engine Section */}
      <section>
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              Cloud Discovery
              {plan === PlanStatus.PAID ? (
                <span className="bg-emerald-100 text-emerald-700 text-[9px] uppercase font-black px-3 py-1 rounded-full">Pro Active</span>
              ) : (
                <span className="bg-amber-100 text-amber-700 text-[9px] uppercase font-black px-3 py-1 rounded-full">Locked</span>
              )}
            </h2>
            <p className="text-slate-500 text-sm font-medium">Scans live store data for verified outreach targets.</p>
          </div>
        </div>

        <div className={`bg-white rounded-[2.5rem] border ${plan === PlanStatus.PAID ? 'border-blue-100 shadow-2xl shadow-blue-50/50' : 'border-slate-200 opacity-60 grayscale'} p-10 relative overflow-hidden transition-all`}>
          {plan !== PlanStatus.PAID && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[1px] p-6 text-center">
               <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-100 max-w-sm">
                  <h3 className="text-lg font-black text-slate-900 mb-2">Unlock Discovery Engine</h3>
                  <p className="text-xs text-slate-500 mb-6 font-medium">Get verified emails for store owners on Shopify, Wix and more automatically.</p>
                  <button onClick={() => {}} className="bg-blue-600 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-100">Upgrade to Elite</button>
               </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Platforms & Industries */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-10">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Target Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {platformsList.map(p => (
                    <button 
                      key={p}
                      disabled={plan !== PlanStatus.PAID || isGenerating}
                      onClick={() => toggleParam('platforms', p)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${genParams.platforms.includes(p) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Industries</label>
                <div className="flex flex-wrap gap-2">
                  {categoriesList.map(c => (
                    <button 
                      key={c}
                      disabled={plan !== PlanStatus.PAID || isGenerating}
                      onClick={() => toggleParam('categories', c)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${genParams.categories.includes(c) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Global Country Filter */}
            <div className="lg:col-span-4 border-l border-slate-50 pl-0 lg:pl-10">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex justify-between">
                Global Regions
                <span className="text-blue-600">{genParams.countries.length} Selected</span>
              </label>
              <div className="space-y-4">
                <input 
                  type="text"
                  placeholder="Search countries..."
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <div className="h-48 overflow-y-auto pr-2 space-y-1 scrollbar-thin">
                   {visibleCountries.length === 0 && <p className="text-[10px] text-slate-400 italic">No matches...</p>}
                   {visibleCountries.map(c => (
                     <button
                        key={c.code}
                        onClick={() => toggleParam('countries', c.name)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-colors flex items-center justify-between ${
                          genParams.countries.includes(c.name) ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'
                        }`}
                     >
                        {c.name}
                        {genParams.countries.includes(c.name) && <span>✓</span>}
                     </button>
                   ))}
                </div>
                <div className="flex gap-2">
                   <button 
                    onClick={() => setGenParams(p => ({ ...p, countries: [] }))}
                    className="flex-1 text-[9px] font-black text-slate-400 uppercase tracking-widest py-2 bg-slate-50 rounded-lg hover:bg-slate-100"
                   >
                     Clear All
                   </button>
                   <button 
                    onClick={() => setGenParams(p => ({ ...p, countries: allCountries.map(c => c.name) }))}
                    className="flex-1 text-[9px] font-black text-blue-600 uppercase tracking-widest py-2 bg-blue-50 rounded-lg hover:bg-blue-100"
                   >
                     Select All
                   </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-10 border-t border-slate-50 flex justify-end">
            <button 
              onClick={handleGenerateLeadsPro}
              disabled={isGenerating || plan !== PlanStatus.PAID}
              className="w-full lg:w-auto bg-blue-600 text-white px-12 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-blue-100 hover:bg-blue-700 transition active:scale-95 disabled:opacity-50"
            >
              {isGenerating ? 'Scanning Cloud...' : 'Launch Global Discovery'}
            </button>
          </div>
        </div>
      </section>

      {/* Database View */}
      <section className="space-y-6">
        <header className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Lead Database</h2>
            <div className="flex items-center gap-3">
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest text-[10px]">{leads.length} Records Total</p>
              {leads.length > 0 && (
                <button 
                  type="button"
                  onClick={handleClearTrigger}
                  className={`text-rose-500 text-[10px] font-black uppercase tracking-widest hover:underline transition px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-rose-200 active:scale-95 ${isClearing ? 'opacity-50 grayscale' : ''}`}
                >
                  {isClearing ? '[ CLEARING DATABASE... ]' : '[ CLEAR ALL LEADS ]'}
                </button>
              )}
            </div>
          </div>
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition shadow-sm"
          >
            📥 Import Leads
          </button>
        </header>

        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50">
             <div className="flex gap-4 items-center">
                <input 
                  type="text" 
                  placeholder="Search leads..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold w-64 outline-none shadow-sm focus:ring-2 focus:ring-blue-500 transition-all"
                />
                {searchTerm && (
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg uppercase tracking-widest animate-in fade-in slide-in-from-left-2 duration-300">
                    {filteredLeads.length} Found
                  </span>
                )}
             </div>
             <div className="flex gap-2">
                <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none shadow-sm">
                   <option value="">All Platforms</option>
                   {platformsList.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
             </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                  <th className="px-8 py-5">Prospect</th>
                  <th className="px-8 py-5">Organization</th>
                  <th className="px-8 py-5">Platform</th>
                  <th className="px-8 py-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center">
                       <div className="flex flex-col items-center gap-2 opacity-40">
                          <p className="text-[24px]">📂</p>
                          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No records found</p>
                       </div>
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50/50 transition group">
                      <td className="px-8 py-6">
                        <p className="font-black text-slate-900 text-sm mb-0.5">{lead.firstName} {lead.lastName}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{lead.email || lead.website}</p>
                      </td>
                      <td className="px-8 py-6 font-bold text-slate-600">{lead.companyName}</td>
                      <td className="px-8 py-6 uppercase tracking-widest text-[9px] font-black text-slate-400">{lead.platform}</td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {lead.website && (
                            <a 
                              href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-100 transition whitespace-nowrap"
                            >
                              Open Browser
                            </a>
                          )}
                          <button onClick={() => setLeads(prev => prev.filter(l => l.id !== lead.id))} className="text-slate-300 hover:text-rose-500 transition-colors p-2">✕</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Manual Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsImportModalOpen(false)} />
          <div className="relative bg-white w-full max-w-xl rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] p-10 overflow-hidden">
            <h3 className="text-2xl font-black text-slate-900 mb-2">Import New Leads</h3>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest text-[10px] mb-8">Pasted data or CSV Upload</p>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Pasted Content (Tab/Comma separated or URLs)</label>
                <textarea 
                  value={pastedData}
                  onChange={(e) => setPastedData(e.target.value)}
                  placeholder="First, Last, Company, Email... OR paste a list of URLs (e.g. example.com)"
                  className="w-full h-48 bg-slate-50 border border-slate-200 rounded-[1.5rem] p-5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition shadow-inner"
                />
              </div>

              <div className="flex gap-4">
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition">📁 Upload File</button>
                <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                
                <button 
                  onClick={() => handleImportAttempt(parseTextToLeads(pastedData))}
                  disabled={!pastedData.trim()}
                  className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-100 hover:bg-blue-700 transition disabled:opacity-50"
                >
                  Confirm Import
                </button>
              </div>
            </div>
            <button onClick={() => setIsImportModalOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600 transition p-2">✕</button>
          </div>
        </div>
      )}

      {/* IMPROVEMENT 1: Duplicate Detection Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" />
          <div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 animate-in fade-in zoom-in duration-300">
            <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center text-amber-600 text-3xl mb-6 mx-auto">⚠️</div>
            <h3 className="text-xl font-black text-slate-900 text-center mb-2">Duplicate leads detected</h3>
            <p className="text-slate-500 text-sm text-center font-medium mb-6">The following email addresses already exist in your system or are repeated in your file.</p>
            
            <div className="bg-slate-50 rounded-2xl p-4 max-h-48 overflow-y-auto mb-8 border border-slate-100">
               {duplicateEmails.map((email, i) => (
                 <div key={i} className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-1 truncate border-b border-slate-200/50 last:border-0">
                   {email}
                 </div>
               ))}
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => processImport(pendingImportQueue)}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-100 hover:bg-blue-700 transition active:scale-95"
              >
                ✅ REMOVE ALL DUPLICATES
              </button>
              <button 
                onClick={() => {
                  setShowDuplicateModal(false);
                  setDuplicateEmails([]);
                  setPendingImportQueue([]);
                }}
                className="w-full bg-slate-100 text-slate-500 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition"
              >
                Cancel Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadManagement;
