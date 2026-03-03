
import React from 'react';

interface LandingPageProps {
  onEnter: (mode: 'login' | 'signup') => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  return (
    <div className="bg-white min-h-screen text-slate-900 selection:bg-blue-100">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 h-16 flex items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 w-8 h-8 rounded-lg flex items-center justify-center text-white font-black">C</div>
          <span className="text-xl font-black tracking-tight text-slate-900">ColdReach</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onEnter('login')} 
            className="text-slate-600 px-4 py-2 text-sm font-black uppercase tracking-widest hover:text-blue-600 transition"
          >
            Log In
          </button>
          <button 
            onClick={() => onEnter('signup')} 
            className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition uppercase tracking-tight"
          >
            Sign Up
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 lg:px-12 max-w-7xl mx-auto text-center">
        <div className="inline-block bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full mb-6">
          Outreach Reimagined for Africa
        </div>
        <h1 className="text-5xl lg:text-7xl font-black text-slate-900 mb-8 tracking-tighter leading-[1.1]">
          Find Leads. Personalize Outreach. <br className="hidden lg:block" /> 
          <span className="text-blue-600">Close More Deals — Faster.</span>
        </h1>
        <p className="text-lg lg:text-xl text-slate-500 max-w-2xl mx-auto mb-10 font-medium">
          ColdReach helps businesses discover verified leads and send personalized outreach at scale, without the complexity or high costs.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button 
            onClick={() => onEnter('signup')} 
            className="w-full sm:w-auto bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-slate-800 transition active:scale-95"
          >
            Get Started Free
          </button>
          <button 
            onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} 
            className="w-full sm:w-auto bg-white border border-slate-200 text-slate-600 px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-50 transition"
          >
            View Pricing
          </button>
        </div>
        
        {/* Dashboard Preview */}
        <div className="mt-20 relative">
          <div className="absolute inset-0 bg-blue-600/5 blur-[120px] rounded-full"></div>
          <div className="relative bg-white border border-slate-200 rounded-[2.5rem] p-3 lg:p-6 shadow-2xl shadow-slate-200/50 max-w-5xl mx-auto overflow-hidden">
             <div className="bg-slate-50 border border-slate-100 rounded-[2rem] aspect-[16/9] flex items-center justify-center overflow-hidden group relative">
                <img 
                  src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=2426&ixlib=rb-4.0.3" 
                  alt="ColdReach Dashboard Interface" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 brightness-[0.98]" 
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/10 to-transparent pointer-events-none"></div>
             </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-8">
           <div className="flex items-center gap-2">
              <div className="bg-blue-600 w-6 h-6 rounded flex items-center justify-center text-white font-black text-xs">C</div>
              <span className="font-black text-slate-900 tracking-tight">ColdReach</span>
           </div>
           <p className="text-xs text-slate-400 font-medium">© 2026 ColdReach — Built for results.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
