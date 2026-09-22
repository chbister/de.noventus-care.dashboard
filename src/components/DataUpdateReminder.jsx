import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, CheckCircle } from 'lucide-react';

const STORAGE_KEY = 'lastDataConfirmation';
const INTERVAL_DAYS = 14;

export default function DataUpdateReminder({ manualTrigger, onManualTriggerConsumed }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const last = localStorage.getItem(STORAGE_KEY);
    if (!last) {
      setShow(true);
      return;
    }
    const diff = Date.now() - new Date(last).getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    if (days >= INTERVAL_DAYS) setShow(true);
  }, []);

  // Manual trigger from external button
  useEffect(() => {
    if (manualTrigger) {
      setShow(true);
      if (onManualTriggerConsumed) onManualTriggerConsumed();
    }
  }, [manualTrigger]);

  const confirm = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-amber-500 px-6 py-4 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-white shrink-0" />
          <h2 className="font-bold text-white text-lg">Datenaktualisierung</h2>
          <button onClick={confirm} className="ml-auto text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-slate-700 text-sm leading-relaxed mb-2">
            Es ist wieder an der Zeit, Ihre Daten zu aktualisieren und zu bestätigen.
          </p>
          <p className="text-slate-400 text-xs">
            Bitte prüfen Sie Belegungszahlen, Mitarbeiterdaten und Kosten und bestätigen Sie die Richtigkeit.
          </p>
        </div>
        <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2">
          <button onClick={confirm}
            className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-lg hover:bg-teal-700 text-sm font-medium transition-all">
            <CheckCircle className="w-4 h-4" />
            Bestätigen
          </button>
        </div>
      </div>
    </div>
  );
}