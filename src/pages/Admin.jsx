import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Shield, Save, ChevronDown, ChevronUp, UserCog, History } from 'lucide-react';
import Aenderungsprotokoll from '@/components/admin/Aenderungsprotokoll';
import Datenverwaltung from '@/components/admin/Datenverwaltung';

const ROLLEN = [
  { value: 'admin', label: 'Admin', desc: 'Vollzugriff auf alles' },
  { value: 'einrichtungsleitung', label: 'Einrichtungsleitung', desc: 'Leitung einer Einrichtung' },
  { value: 'pflegedienstleitung', label: 'Pflegedienstleitung', desc: 'Pflegerische Leitung' },
  { value: 'verwaltung', label: 'Verwaltung', desc: 'Verwaltungsbereich' },
];

const ALLE_SEITEN = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'wohnbereiche', label: 'Wohnbereiche' },
  { key: 'tagespflege', label: 'Tagespflege' },
  { key: 'mitarbeiter', label: 'Mitarbeiter' },
  { key: 'heimkosten', label: 'Heimkosten' },
  { key: 'bewohner-kosten', label: 'Bewohner Kosten' },
  { key: 'verguetung', label: 'Vergütung' },
  { key: 'belegungszahlen', label: 'Belegungszahlen' },
  { key: 'monatsabschluss', label: 'Monatsabschluss' },
  { key: 'belegungsverlauf', label: 'Belegungsverlauf' },
  { key: 'einstellungen', label: 'Einstellungen' },
];

const ROLLEN_DEFAULTS = {
  admin: { seiten: ALLE_SEITEN.map(s => s.key), alleEinrichtungen: true },
  einrichtungsleitung: { seiten: ['dashboard','wohnbereiche','tagespflege','mitarbeiter','heimkosten','bewohner-kosten','belegungszahlen','monatsabschluss','belegungsverlauf'], alleEinrichtungen: false },
  pflegedienstleitung: { seiten: ['dashboard','wohnbereiche','tagespflege','mitarbeiter','belegungszahlen','belegungsverlauf'], alleEinrichtungen: false },
  verwaltung: { seiten: ['dashboard','heimkosten','bewohner-kosten','verguetung'], alleEinrichtungen: false },
};

function UserRow({ user, einrichtungen, onSave }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    role: user.role || 'verwaltung',
    erlaubte_einrichtungen: user.role === 'admin' ? einrichtungen.map(e => e.id) : (user.erlaubte_einrichtungen || []),
    erlaubte_seiten: user.role === 'admin' ? ALLE_SEITEN.map(s => s.key) : (user.erlaubte_seiten || ROLLEN_DEFAULTS[user.role || 'verwaltung']?.seiten || []),
  });
  const [saving, setSaving] = useState(false);

  const isAdmin = form.role === 'admin';

  const applyRoleDefaults = (rolle) => {
    const def = ROLLEN_DEFAULTS[rolle];
    setForm(p => ({
      ...p,
      role: rolle,
      erlaubte_seiten: def?.seiten || [],
      erlaubte_einrichtungen: def?.alleEinrichtungen ? einrichtungen.map(e => e.id) : p.erlaubte_einrichtungen,
    }));
  };

  const toggleSeite = (key) => {
    setForm(p => ({
      ...p,
      erlaubte_seiten: p.erlaubte_seiten.includes(key)
        ? p.erlaubte_seiten.filter(s => s !== key)
        : [...p.erlaubte_seiten, key],
    }));
  };

  const toggleEinrichtung = (id) => {
    setForm(p => ({
      ...p,
      erlaubte_einrichtungen: p.erlaubte_einrichtungen.includes(id)
        ? p.erlaubte_einrichtungen.filter(e => e !== id)
        : [...p.erlaubte_einrichtungen, id],
    }));
  };

  const save = async () => {
    setSaving(true);
    await base44.auth.updateMe ? null : null; // not for self
    await base44.entities.User.update(user.id, {
      role: form.role,
      erlaubte_einrichtungen: isAdmin ? einrichtungen.map(e => e.id) : form.erlaubte_einrichtungen,
      erlaubte_seiten: isAdmin ? ALLE_SEITEN.map(s => s.key) : form.erlaubte_seiten,
    });
    setSaving(false);
    onSave();
    setOpen(false);
  };

  const rolleObj = ROLLEN.find(r => r.value === form.role);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-all text-left"
      >
        <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
          <UserCog className="w-4 h-4 text-teal-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate">{user.full_name || '—'}</p>
          <p className="text-xs text-slate-400 truncate">{user.email}</p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          form.role === 'admin' ? 'bg-violet-100 text-violet-700' :
          form.role === 'einrichtungsleitung' ? 'bg-blue-100 text-blue-700' :
          form.role === 'pflegedienstleitung' ? 'bg-teal-100 text-teal-700' :
          'bg-slate-100 text-slate-600'
        }`}>{rolleObj?.label || form.role}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-5">
          {/* Rolle */}
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">Rolle</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ROLLEN.map(r => (
                <button
                  key={r.value}
                  onClick={() => applyRoleDefaults(r.value)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium text-left transition-all ${
                    form.role === r.value
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div>{r.label}</div>
                  <div className="text-xs font-normal text-slate-400 mt-0.5">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {!isAdmin && (
            <>
              {/* Einrichtungen */}
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">Einrichtungen</label>
                <div className="flex flex-wrap gap-2">
                  {einrichtungen.map(e => (
                    <label key={e.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 text-sm">
                      <input type="checkbox"
                        checked={form.erlaubte_einrichtungen.includes(e.id)}
                        onChange={() => toggleEinrichtung(e.id)}
                        className="rounded border-slate-300 text-teal-600" />
                      {e.name}
                    </label>
                  ))}
                </div>
              </div>

              {/* Seiten */}
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">Sichtbare Bereiche</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {ALLE_SEITEN.map(s => (
                    <label key={s.key} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 text-sm">
                      <input type="checkbox"
                        checked={form.erlaubte_seiten.includes(s.key)}
                        onChange={() => toggleSeite(s.key)}
                        className="rounded border-slate-300 text-teal-600" />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {isAdmin && (
            <p className="text-sm text-slate-400 italic">Admin hat automatisch Zugriff auf alle Bereiche und Einrichtungen.</p>
          )}

          <div className="flex justify-end">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const { einrichtungen } = useEinrichtung();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('benutzer');

  const load = async () => {
    setLoading(true);
    const [allUsers, me] = await Promise.all([
      base44.entities.User.list(),
      base44.auth.me(),
    ]);
    setUsers(allUsers);
    setCurrentUser(me);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (currentUser && currentUser.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-700">Kein Zugriff</h2>
        <p className="text-slate-400 mt-2">Dieser Bereich ist nur für Administratoren.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-violet-100 rounded-lg">
          <Shield className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Administration</h1>
          <p className="text-sm text-slate-500 mt-0.5">Benutzer, Daten und Änderungsprotokoll verwalten</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('benutzer')}
          className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'benutzer' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Benutzerverwaltung
        </button>
        <button
          onClick={() => setActiveTab('daten')}
          className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'daten' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          🗑 Datenverwaltung
        </button>
        <button
          onClick={() => setActiveTab('protokoll')}
          className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'protokoll' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Änderungsprotokoll
        </button>
      </div>

      {loading && activeTab === 'benutzer' ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'benutzer' && (
            <div className="space-y-3">
              {users.map(u => (
                <UserRow key={u.id} user={u} einrichtungen={einrichtungen} onSave={load} />
              ))}
              {users.length === 0 && (
                <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400">
                  Keine Benutzer gefunden
                </div>
              )}
            </div>
          )}
          {activeTab === 'daten' && <Datenverwaltung />}
          {activeTab === 'protokoll' && <Aenderungsprotokoll />}
        </>
      )}
    </div>
  );
}