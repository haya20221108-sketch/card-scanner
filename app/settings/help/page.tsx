'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, HelpCircle, ChevronDown, ChevronUp, BookOpen, MessageCircle } from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans max-w-md mx-auto pb-20">
      <header className="flex items-center gap-4 mb-10 pt-4">
        <Link href="/settings" className="p-2 -ml-2 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">Help Center</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Guide & Support</p>
        </div>
      </header>

      <div className="space-y-8">
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
            <BookOpen size={12} /> Frequently Asked Questions
          </h3>
          
          <div className="space-y-3">
            <FAQItem 
              question="How does AI scanning work?" 
              answer="Nexus uses advanced text recognition to detect card names and matching logic to identify card sets and ranks. Best results are obtained in bright, even lighting." 
            />
            <FAQItem 
              question="Can I scan multiple cards at once?" 
              answer="Yes! Select multiple photos in the scanner. The system processes them in parallel to save you time." 
            />
            <FAQItem 
              question="Is my data safe?" 
              answer="All collection data is stored securely in Supabase and synced across your devices. You can export your inventory anytime from the Export menu." 
            />
          </div>
        </section>

        <section className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500 rounded-2xl shadow-lg">
              <MessageCircle size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black italic uppercase leading-none">Support</h2>
              <p className="text-[9px] opacity-60 uppercase font-bold tracking-widest mt-1">Direct Assistance</p>
            </div>
          </div>
          {/* 実装予定: サポートチケット送信ロジック */}
          <button 
            disabled 
            className="w-full py-4 bg-white/20 text-white/50 rounded-2xl font-black text-[10px] uppercase tracking-widest cursor-not-allowed"
          >
            Open Support Ticket (実装予定)
          </button>
        </section>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="bg-white rounded-[1.5rem] border border-slate-100 overflow-hidden shadow-sm">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 flex items-center justify-between text-left transition-colors active:bg-slate-50"
      >
        <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{question}</span>
        {isOpen ? <ChevronUp size={16} className="text-slate-300" /> : <ChevronDown size={16} className="text-slate-300" />}
      </button>
      {isOpen && (
        <div className="px-5 pb-5 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-[11px] font-bold text-slate-500 leading-relaxed uppercase">{answer}</p>
        </div>
      )}
    </div>
  );
}