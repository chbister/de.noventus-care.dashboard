import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BedDouble, Users, Settings, Menu, X,
  Activity, CreditCard, ChevronDown, Building2, FileText, Shield, HeartHandshake, Home, LogOut, RefreshCw, Brain, BookOpen, MessageCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import DataUpdateReminder from '@/components/DataUpdateReminder';

const NAV_ITEMS = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { name: 'Wohnbereiche', icon: BedDouble, path: '/wohnbereiche' },
  { name: 'Mitarbeiter', icon: Users, path: '/mitarbeiter' },
  { name: 'Mitarbeiterkosten /Heimkosten', icon: CreditCard, path: '/heimkosten' },
  { name: 'Controlling', icon: CreditCard, path: '/controlling' },
  { name: 'KI-Analyse', icon: Brain, path: '/ki-analyse' },
  { name: 'Einstellungen', icon: Settings, path: '/einstellungen' },
  { name: 'Handbuch', icon: BookOpen, path: '/handbuch' },
  { name: 'Team-Chat', icon: MessageCircle, path: '/chat' },
  { name: 'Admin', icon: Shield, path: '/admin', adminOnly: true },
];

const WEITERE_BEREICHE = ['tagespflege', 'eingliederungshilfe', 'betreutes_wohnen'];

const WEITERE_ITEMS = [
  { name: 'Tagespflege', icon: BedDouble, path: '/tagespflege', bereich: 'tagespflege' },
  { name: 'Eingliederungshilfe', icon: HeartHandshake, path: '/eingliederungshilfe', bereich: 'eingliederungshilfe' },
  { name: 'Betreutes Wohnen', icon: Home, path: '/betreutes-wohnen', bereich: 'betreutes_wohnen' },
];

const BETREUTES_WOHNEN_ITEMS = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/betreutes-wohnen-dashboard' },
  { name: 'Stammdaten', icon: Home, path: '/betreutes-wohnen' },
];

const EGH_ITEMS = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/eingliederungshilfe' },
];

const TAGESPFLEGE_ITEMS = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/tagespflege-dashboard' },
  { name: 'Stammdaten', icon: BedDouble, path: '/tagespflege' },
];

// Left vertical sidebar: Einrichtung + Weitere Bereiche
function LeftSidebar({ selectedEinrichtung, einrichtungen, selectEinrichtung, currentUser, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();

  const visibleEinrichtungen = einrichtungen.filter(e => {
    if (WEITERE_BEREICHE.includes(e.bereich)) return false;
    if (!currentUser || currentUser.role === 'admin') return true;
    const erlaubt = currentUser.erlaubte_einrichtungen;
    if (!erlaubt || erlaubt.length === 0) return true;
    return erlaubt.includes(e.id);
  });

  return (
    <aside className="w-52 bg-slate-900 flex flex-col shrink-0 h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-700/50">
        <div className="p-1.5 bg-teal-500 rounded-lg shrink-0">
          <Activity className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-white tracking-tight text-sm">RFC Personal</span>
      </div>

      {/* Einrichtungen */}
      {visibleEinrichtungen.length > 0 && (
        <div className="px-3 py-4 border-b border-slate-700/50">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2 px-2">Einrichtung</p>
          <div className="space-y-0.5">
            {visibleEinrichtungen.map(e => (
              <button
                key={e.id}
                onClick={() => { selectEinrichtung(e); navigate('/'); }}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-left transition-all",
                  selectedEinrichtung?.id === e.id
                    ? "bg-teal-500 text-white font-medium shadow-sm"
                    : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
                )}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0 opacity-70" />
                <span className="truncate">{e.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Weitere Bereiche */}
      <div className="px-3 py-4 flex-1 overflow-y-auto">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2 px-2">Weitere Bereiche</p>
        <div className="space-y-0.5">
          {WEITERE_ITEMS.map(item => {
            const subEinrichtungen = einrichtungen.filter(e => e.bereich === item.bereich);
            const isBWSection = item.bereich === 'betreutes_wohnen';
            const isSectionActive = location.pathname === item.path || subEinrichtungen.some(e => selectedEinrichtung?.id === e.id);
            
            return (
              <div key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    location.pathname === item.path
                      ? "bg-teal-500 text-white shadow-sm"
                      : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
                  )}
                >
                  <item.icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{item.name}</span>
                </Link>
                


                {subEinrichtungen.map(e => (
                  <button
                    key={e.id}
                    onClick={() => { selectEinrichtung(e); navigate(item.path); }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-left transition-all ml-3",
                      selectedEinrichtung?.id === e.id
                        ? "bg-teal-500/80 text-white font-medium"
                        : "text-slate-400 hover:bg-slate-700/60 hover:text-white"
                    )}
                  >
                    <Building2 className="w-3 h-3 shrink-0 opacity-60" />
                    <span className="truncate">{e.name}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* User & Logout */}
      <div className="px-3 py-3 border-t border-slate-700/50">
        <div className="px-2 mb-2">
          <p className="text-xs text-slate-300 truncate">{currentUser?.full_name || currentUser?.email || 'Benutzer'}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">{currentUser?.role || ''}</p>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700/60 hover:text-white transition-all"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0 opacity-70" />
          <span>Abmelden</span>
        </button>
      </div>
    </aside>
  );
}

// Top horizontal nav: main nav items
function TopNav({ navItems }) {
  const location = useLocation();
  const isBWSection = location.pathname.includes('/betreutes-wohnen');
  const isEGHSection = location.pathname.includes('/eingliederungshilfe');
  const isTPSection = location.pathname.includes('/tagespflege');

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="flex items-center px-3 h-11 gap-0.5 overflow-x-auto">
        {isTPSection ? (
          TAGESPFLEGE_ITEMS.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0",
                location.pathname === item.path
                  ? "bg-orange-50 text-orange-700 font-semibold"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              )}
            >
              <item.icon className="w-3.5 h-3.5 shrink-0" />
              {item.name}
            </Link>
          ))
        ) : isEGHSection ? (
          EGH_ITEMS.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0",
                location.pathname === item.path
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              )}
            >
              <item.icon className="w-3.5 h-3.5 shrink-0" />
              {item.name}
            </Link>
          ))
        ) : isBWSection ? (
          BETREUTES_WOHNEN_ITEMS.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0",
                location.pathname === item.path
                  ? "bg-teal-50 text-teal-700 font-semibold"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              )}
            >
              <item.icon className="w-3.5 h-3.5 shrink-0" />
              {item.name}
            </Link>
          ))
        ) : (
          (() => {
            const rendered = [];
            let lastGroup = null;
            navItems.forEach((item, idx) => {
              if (item.group && item.group !== lastGroup) {
                rendered.push(
                  <div key={`sep-${item.group}`} className="flex items-center shrink-0 mx-1">
                    <div className="w-px h-5 bg-slate-200" />
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-2 mr-1">{item.group}</span>
                  </div>
                );
                lastGroup = item.group;
              } else if (!item.group && lastGroup) {
                rendered.push(<div key={`sep-end-${idx}`} className="w-px h-5 bg-slate-200 mx-1 shrink-0" />);
                lastGroup = null;
              }
              rendered.push(
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0",
                    location.pathname === item.path
                      ? "bg-teal-50 text-teal-700 font-semibold"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  )}
                >
                  {item.name}
                </Link>
              );
            });
            return rendered;
          })()
        )}
      </div>
    </header>
  );
}

// Mobile Sidebar (all-in-one)
function MobileSidebar({ navItems, selectedEinrichtung, einrichtungen, selectEinrichtung, onClose, currentUser, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();

  const visibleEinrichtungen = einrichtungen.filter(e => {
    if (WEITERE_BEREICHE.includes(e.bereich)) return false;
    if (!currentUser || currentUser.role === 'admin') return true;
    const erlaubt = currentUser.erlaubte_einrichtungen;
    if (!erlaubt || erlaubt.length === 0) return true;
    return erlaubt.includes(e.id);
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
        <div className="p-1.5 bg-teal-600 rounded-lg shrink-0">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-slate-900 tracking-tight">RFC Personal</span>
        <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-slate-100">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {visibleEinrichtungen.length > 0 && (
        <div className="px-3 py-3 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">Einrichtung</p>
          <div className="space-y-0.5">
            {visibleEinrichtungen.map(e => (
              <button key={e.id} onClick={() => { selectEinrichtung(e); navigate('/'); onClose(); }}
                className={cn("flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-left transition-all",
                  selectedEinrichtung?.id === e.id ? "bg-teal-600 text-white font-medium" : "text-slate-600 hover:bg-slate-100"
                )}>
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="truncate">{e.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">
        {(() => {
          const rendered = [];
          let lastGroup = null;
          navItems.forEach((item, idx) => {
            if (item.group && item.group !== lastGroup) {
              rendered.push(
                <p key={`grp-${item.group}`} className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 pt-3 pb-1">{item.group}</p>
              );
              lastGroup = item.group;
            }
            rendered.push(
              <Link key={item.path} to={item.path} onClick={onClose}
                className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  item.group ? "pl-5" : "",
                  location.pathname === item.path ? "bg-teal-50 text-teal-700" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                )}>
                <item.icon className="w-4 h-4 shrink-0" />
                {item.name}
              </Link>
            );
          });
          return rendered;
        })()}
      </nav>

      <div className="px-3 py-3 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">Weitere Bereiche</p>
        <div className="space-y-0.5">
          {WEITERE_ITEMS.map(item => {
            const subEinrichtungen = einrichtungen.filter(e => e.bereich === item.bereich);
            return (
              <div key={item.path}>
                <Link to={item.path} onClick={onClose}
                  className={cn("flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    location.pathname === item.path ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100"
                  )}>
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
                {subEinrichtungen.map(e => (
                  <button key={e.id} onClick={() => { selectEinrichtung(e); onClose(); }}
                    className={cn("flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-left transition-all ml-3",
                      selectedEinrichtung?.id === e.id ? "bg-teal-600 text-white font-medium" : "text-slate-500 hover:bg-slate-100"
                    )}>
                    <Building2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">{e.name}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* User & Logout */}
      <div className="px-3 py-3 border-t border-slate-100">
        <div className="px-1 mb-2">
          <p className="text-sm text-slate-700 truncate">{currentUser?.full_name || currentUser?.email || 'Benutzer'}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">{currentUser?.role || ''}</p>
        </div>
        <button
          onClick={() => { onLogout(); onClose(); }}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Abmelden</span>
        </button>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [dataReminderTrigger, setDataReminderTrigger] = useState(0);
  const { einrichtungen, selectedEinrichtung, selectEinrichtung } = useEinrichtung();

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  const isAdmin = currentUser?.role === 'admin';

  const navItems = NAV_ITEMS.filter(item => {
    if (item.adminOnly) return isAdmin;
    if (isAdmin) return true;
    if (currentUser?.role === 'benutzer_ilsede') return item.path === '/heimkosten';
    const erlaubteSeiten = currentUser?.erlaubte_seiten;
    if (!erlaubteSeiten || erlaubteSeiten.length === 0) return true;
    if (item.submenu) return item.submenu.some(s => erlaubteSeiten.includes(s.path.replace('/', '')));
    return erlaubteSeiten.includes(item.path.replace('/', '') || 'dashboard');
  });

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left Sidebar: desktop only */}
      <div className="hidden md:block">
        <LeftSidebar
          selectedEinrichtung={selectedEinrichtung}
          einrichtungen={einrichtungen}
          selectEinrichtung={selectEinrichtung}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      </div>

      {/* Right side: top nav + content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop top nav */}
        <div className="hidden md:block relative">
          <TopNav navItems={navItems} />
          <button
            onClick={() => setDataReminderTrigger(t => t + 1)}
            title="Datenaktualisierung jetzt prüfen"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 transition-all whitespace-nowrap shadow-sm shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Datenprüfung
          </button>
        </div>

        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100 sticky top-0 z-40">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-slate-50">
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <div className="p-1.5 bg-teal-600 rounded-lg">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-sm">RFC Personal</span>
          {selectedEinrichtung && (
            <span className="ml-auto text-xs text-teal-600 font-medium truncate max-w-[120px]">
              {selectedEinrichtung.name}
            </span>
          )}
          <button
            onClick={() => setDataReminderTrigger(t => t + 1)}
            title="Datenaktualisierung jetzt prüfen"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 transition-all shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="w-64 bg-white h-full shadow-xl flex flex-col">
              <MobileSidebar
                navItems={navItems}
                selectedEinrichtung={selectedEinrichtung}
                einrichtungen={einrichtungen}
                selectEinrichtung={selectEinrichtung}
                onClose={() => setMobileOpen(false)}
                currentUser={currentUser}
                onLogout={handleLogout}
              />
            </div>
            <div className="flex-1 bg-black/30" onClick={() => setMobileOpen(false)} />
          </div>
        )}

        <main className="flex-1">{children}</main>
      </div>

      <DataUpdateReminder
        manualTrigger={dataReminderTrigger}
        onManualTriggerConsumed={() => setDataReminderTrigger(0)}
      />
    </div>
  );
}