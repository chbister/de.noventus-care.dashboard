import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Activity, Users, BedDouble, TrendingUp, Building2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import TrafficLight from '@/components/TrafficLight';
import PebemPersonalTable from '@/components/dashboard/PebemPersonalTable';

export default function Dashboard() {
  const { selectedEinrichtung, einrichtungen } = useEinrichtung();
  const [wohnbereiche, setWohnbereiche] = useState([]);
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [tagespflege, setTagespflege] = useState([]);
  const [einrichtung, setEinrichtung] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedEinrichtung) return;
    setLoading(true);
    Promise.all([
      base44.entities.Wohnbereich.filter({ einrichtung_id: selectedEinrichtung.id }),
      base44.entities.Mitarbeiter.filter({ einrichtung_id: selectedEinrichtung.id, aktiv: true }),
      base44.entities.Tagespflege.filter({ einrichtung_id: selectedEinrichtung.id }),
    ]).then(([wb, ma, tp]) => {
      setWohnbereiche(wb);
      setMitarbeiter(ma);
      setTagespflege(tp);
      setEinrichtung(selectedEinrichtung);
      setLoading(false);
    });
  }, [selectedEinrichtung]);

  if (!selectedEinrichtung && einrichtungen.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Keine Einrichtung vorhanden</h2>
        <p className="text-slate-500 mb-4">Bitte lege zuerst eine Einrichtung an.</p>
        <Link to="/einstellungen" className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-all">
          Einrichtung anlegen
        </Link>
      </div>
    );
  }

  // ── Belegung ──────────────────────────────────────────────
  const gesamtBewohner = wohnbereiche.reduce((s, w) =>
    s + (w.belegung_pg1||0)+(w.belegung_pg2||0)+(w.belegung_pg3||0)+(w.belegung_pg4||0)+(w.belegung_pg5||0)+(w.belegung_ruestige||0)+(w.belegung_pg0||0), 0);
  const gesamtSoll = wohnbereiche.reduce((s, w) => s + (w.sollbelegung || 0), 0);
  const auslastung = gesamtSoll > 0 ? Math.round((gesamtBewohner / gesamtSoll) * 100) : 0;

  const tpBewohner = tagespflege.reduce((s, t) =>
    s + (t.belegung_pg1||0)+(t.belegung_pg2||0)+(t.belegung_pg3||0)+(t.belegung_pg4||0)+(t.belegung_pg5||0)+(t.belegung_ruestige||0), 0);
  const tpSoll = tagespflege.reduce((s, t) => s + (t.sollbelegung || 0), 0);

  // ── Pflegegrad-Verteilung ─────────────────────────────────
  const pgData = [
    { name: 'Rüstige', value: wohnbereiche.reduce((s,w) => s+(w.belegung_ruestige||0),0) },
    { name: 'PG 0',   value: wohnbereiche.reduce((s,w) => s+(w.belegung_pg0||0),0) },
    { name: 'PG 1',   value: wohnbereiche.reduce((s,w) => s+(w.belegung_pg1||0),0) },
    { name: 'PG 2',   value: wohnbereiche.reduce((s,w) => s+(w.belegung_pg2||0),0) },
    { name: 'PG 3',   value: wohnbereiche.reduce((s,w) => s+(w.belegung_pg3||0),0) },
    { name: 'PG 4',   value: wohnbereiche.reduce((s,w) => s+(w.belegung_pg4||0),0) },
    { name: 'PG 5',   value: wohnbereiche.reduce((s,w) => s+(w.belegung_pg5||0),0) },
  ];

  // ── Personal Soll vs. Ist ─────────────────────────────────
  const e = einrichtung || {};
  let sollFk = 0, sollHkMit = 0, sollHkOhne = 0;
  wohnbereiche.forEach(w => {
    const pg2 = (w.belegung_pg2||0)+(w.geplant_pg2||0);
    const pg3 = (w.belegung_pg3||0)+(w.geplant_pg3||0);
    const pg4 = (w.belegung_pg4||0)+(w.geplant_pg4||0);
    const pg5 = (w.belegung_pg5||0)+(w.geplant_pg5||0);
    sollFk    += pg2*(e.schluessel_pg2_fk||0.1017) + pg3*(e.schluessel_pg3_fk||0.1521) + pg4*(e.schluessel_pg4_fk||0.2416) + pg5*(e.schluessel_pg5_fk||0.3768);
    sollHkMit += pg2*(e.schluessel_pg2_hk_mit||0.0136) + pg3*(e.schluessel_pg3_hk_mit||0.0217) + pg4*(e.schluessel_pg4_hk_mit||0.0285) + pg5*(e.schluessel_pg5_hk_mit||0.0223);
    sollHkOhne+= pg2*(e.schluessel_pg2_hk_ohne||0.1173) + pg3*(e.schluessel_pg3_hk_ohne||0.1414) + pg4*(e.schluessel_pg4_hk_ohne||0.1588) + pg5*(e.schluessel_pg5_hk_ohne||0.1716);
  });
  sollFk    = Math.round(sollFk*100)/100;
  sollHkMit = Math.round(sollHkMit*100)/100;
  sollHkOhne= Math.round(sollHkOhne*100)/100;

  const pflegeMa = mitarbeiter.filter(m => m.kategorie === 'pflege' || m.kategorie === 'nachtwache');
  let istFk = 0, istHkMit = 0, istHkOhne = 0;
  pflegeMa.forEach(m => {
    if ((m.vk_pfk||0)+(m.vk_phk_mit_ausbildung||0)+(m.vk_phk_ohne_ausbildung||0) > 0) {
      istFk    += (m.vk_pfk||0)+(m.leih_pfk||0);
      istHkMit += (m.vk_phk_mit_ausbildung||0)+(m.leih_phk_mit||0);
      istHkOhne+= (m.vk_phk_ohne_ausbildung||0)+(m.leih_phk_ohne||0);
    } else {
      const vk = m.vk_anteil||0;
      if (m.funktion === 'PFK') istFk += vk;
      else if (m.funktion === 'PHK m.A.') istHkMit += vk;
      else if (m.funktion === 'PHK o.A.') istHkOhne += vk;
      else {
        const bez = (m.berufsbezeichnung||'').toUpperCase();
        if (['AP','FK','PFK','KS'].includes(bez)) istFk += vk;
        else if (bez === 'APH') istHkMit += vk;
      }
    }
  });
  istFk    = Math.round(istFk*100)/100;
  istHkMit = Math.round(istHkMit*100)/100;
  istHkOhne= Math.round(istHkOhne*100)/100;

  const personalData = [
    { name: 'Fachkräfte (PFK)', Soll: sollFk, Ist: istFk },
    { name: 'HK m. A.',         Soll: sollHkMit, Ist: istHkMit },
    { name: 'HK o. A.',         Soll: sollHkOhne, Ist: istHkOhne },
    { name: 'Gesamt',           Soll: Math.round((sollFk+sollHkMit+sollHkOhne)*100)/100, Ist: Math.round((istFk+istHkMit+istHkOhne)*100)/100 },
  ];

  // Betreuung §43b
  const betreuungMa = mitarbeiter.filter(m => m.kategorie === 'betreuung_43b');
  const betreuungIst = Math.round(betreuungMa.reduce((s,m) => s+(m.vk_pfk||0)+(m.vk_phk_mit_ausbildung||0)+(m.vk_phk_ohne_ausbildung||0),0)*10)/10;
  const betreuungSoll = e.schluessel_43b > 0 ? Math.round((gesamtBewohner / e.schluessel_43b)*10)/10 : 0;
  const betreuungDiff = Math.round((betreuungIst - betreuungSoll)*10)/10;

  // Pflege Ist gesamt (VK)
  const pflegeIstGesamt = Math.round((istFk + istHkMit + istHkOhne)*10)/10;
  const pflegeSollGesamt = Math.round((sollFk + sollHkMit + sollHkOhne)*10)/10;
  const pflegeDiff = Math.round((pflegeIstGesamt - pflegeSollGesamt)*10)/10;

  // Fachkraftquote — alle Werte auf 2 Nachkommastellen gerundet, damit Teiler ≤ Summe
  const gesamtIstVkRaw = istFk + istHkMit + istHkOhne + betreuungIst;
  const gesamtIstVk = Math.round(gesamtIstVkRaw * 100) / 100;
  const fachkraftquote = gesamtIstVk > 0 ? Math.min(100, Math.round((istFk / gesamtIstVk) * 1000) / 10) : 0;

  // Anzahl aktiver Wohnbereiche für gleichmäßige Verteilung von "verteilt_auf_alle"-Mitarbeitern (z.B. Nachtwachen)
  const activeWbCount = wohnbereiche.filter(w => w.aktiv !== false).length || 1;

  const stats = [
    {
      label: 'Bewohner', value: gesamtBewohner, sub: `von ${gesamtSoll} Plätzen`,
      badge: `+${auslastung}% Auslastung`, badgeColor: 'text-teal-600 bg-teal-50',
      icon: BedDouble, iconColor: 'text-teal-600', iconBg: 'bg-teal-50',
    },
    {
      label: 'Pflege Ist (VK)', value: pflegeIstGesamt, sub: `Soll: ${pflegeSollGesamt} VK`,
      badge: `${pflegeDiff >= 0 ? '+' : ''}${pflegeDiff} VK`, badgeColor: pflegeDiff >= 0 ? 'text-teal-600 bg-teal-50' : 'text-red-600 bg-red-50',
      icon: Users, iconColor: 'text-blue-600', iconBg: 'bg-blue-50',
    },
    {
      label: 'Betreuung §43b (VK)', value: betreuungIst, sub: `Soll: ${betreuungSoll} VK`,
      badge: `${betreuungDiff >= 0 ? '+' : ''}${betreuungDiff} VK`, badgeColor: betreuungDiff >= 0 ? 'text-teal-600 bg-teal-50' : 'text-red-600 bg-red-50',
      icon: Activity, iconColor: 'text-orange-600', iconBg: 'bg-orange-50',
    },
    {
      label: 'Fachkraftquote (Ist)', value: `${fachkraftquote}%`, sub: 'Ist-Personal',
      badge: null,
      icon: TrendingUp, iconColor: 'text-violet-600', iconBg: 'bg-violet-50',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{selectedEinrichtung?.name}</h1>
        <p className="text-slate-500 text-sm mt-1">{selectedEinrichtung?.standort}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                    <s.icon className={`w-4 h-4 ${s.iconColor}`} />
                  </div>
                  {s.badge && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.badgeColor}`}>{s.badge}</span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mb-0.5">{s.label}</div>
                <div className="text-2xl font-bold text-slate-900">{s.value}</div>
                <div className="text-xs text-slate-400 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Pflegegrad-Verteilung */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h2 className="font-semibold text-slate-900 mb-4">Pflegegrad-Verteilung</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pgData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="value" name="Bewohner" fill="#14b8a6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Personal Soll vs. Ist */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h2 className="font-semibold text-slate-900 mb-4">Personal Soll vs. Ist (VK)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={personalData} barSize={18} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Soll" fill="#14b8a6" radius={[4,4,0,0]} />
                  <Bar dataKey="Ist"  fill="#1e293b" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PeBeM Personalschlüssel */}
          {e.pebem_aktiv !== false && (
            <PebemPersonalTable
              wohnbereiche={wohnbereiche}
              einrichtung={e}
              istFk={istFk}
              istHkMit={istHkMit}
              istHkOhne={istHkOhne}
            />
          )}

          {/* Wohnbereiche Karten */}
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Wohnbereiche</h2>
              <p className="text-xs text-teal-600">Übersicht aller Wohnbereiche</p>
            </div>
            <Link to="/wohnbereiche" className="text-sm text-teal-600 hover:underline">Alle anzeigen →</Link>
          </div>

          {wohnbereiche.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p>Noch keine Wohnbereiche angelegt</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {wohnbereiche.map(wb => {
                const ist = (wb.belegung_pg1||0)+(wb.belegung_pg2||0)+(wb.belegung_pg3||0)+(wb.belegung_pg4||0)+(wb.belegung_pg5||0)+(wb.belegung_ruestige||0)+(wb.belegung_pg0||0);
                const soll = wb.sollbelegung || 0;
                const pct  = soll > 0 ? Math.round((ist/soll)*100) : 0;

                // VK für diesen Wohnbereich — verteilt_auf_alle wird gleichmäßig auf aktive WBs geteilt
                const wbIsActive = wb.aktiv !== false;
                const wbMa = mitarbeiter.filter(m => m.wohnbereich_id === wb.id || (m.verteilt_auf_alle && wbIsActive));
                const wbVk = Math.round(wbMa.reduce((s,m) => {
                  const vk = (m.vk_pfk||0)+(m.vk_phk_mit_ausbildung||0)+(m.vk_phk_ohne_ausbildung||0);
                  return s + (m.verteilt_auf_alle ? vk / activeWbCount : vk);
                },0)*10)/10;

                // VK Soll für diesen Wohnbereich
                const pg2 = (wb.belegung_pg2||0)+(wb.geplant_pg2||0);
                const pg3 = (wb.belegung_pg3||0)+(wb.geplant_pg3||0);
                const pg4 = (wb.belegung_pg4||0)+(wb.geplant_pg4||0);
                const pg5 = (wb.belegung_pg5||0)+(wb.geplant_pg5||0);
                const wbSollVk = Math.round((
                  pg2*(e.schluessel_pg2_fk||0.1017)+pg3*(e.schluessel_pg3_fk||0.1521)+pg4*(e.schluessel_pg4_fk||0.2416)+pg5*(e.schluessel_pg5_fk||0.3768)+
                  pg2*(e.schluessel_pg2_hk_mit||0.0136)+pg3*(e.schluessel_pg3_hk_mit||0.0217)+pg4*(e.schluessel_pg4_hk_mit||0.0285)+pg5*(e.schluessel_pg5_hk_mit||0.0223)+
                  pg2*(e.schluessel_pg2_hk_ohne||0.1173)+pg3*(e.schluessel_pg3_hk_ohne||0.1414)+pg4*(e.schluessel_pg4_hk_ohne||0.1588)+pg5*(e.schluessel_pg5_hk_ohne||0.1716)
                )*10)/10;
                const vkDiff = Math.round((wbVk - wbSollVk)*10)/10;

                const pctColor = pct >= 100 ? 'text-red-500' : pct >= 90 ? 'text-orange-500' : pct >= 70 ? 'text-amber-500' : 'text-slate-500';
                const barColor = pct >= 100 ? 'bg-red-400' : pct >= 90 ? 'bg-orange-400' : 'bg-teal-500';

                const pgBars = [
                  { label: 'PG2', val: wb.belegung_pg2||0 },
                  { label: 'PG3', val: wb.belegung_pg3||0 },
                  { label: 'PG4', val: wb.belegung_pg4||0 },
                  { label: 'PG5', val: wb.belegung_pg5||0 },
                ];
                const pgMax = Math.max(...pgBars.map(p => p.val), 1);

                return (
                  <div key={wb.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-slate-900">{wb.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${pctColor}`}>{pct}% Auslastung</span>
                        <TrafficLight percentage={pct} />
                      </div>
                    </div>

                    <div className="flex gap-6 mb-4">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <BedDouble className="w-4 h-4 text-slate-300" />
                          <span className="text-2xl font-bold text-slate-900">{ist}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">von {soll} Plätzen</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-slate-300" />
                          <span className="text-2xl font-bold text-slate-900">{wbVk}</span>
                        </div>
                        <p className={`text-xs mt-0.5 font-medium ${vkDiff >= 0 ? 'text-teal-600' : 'text-red-500'}`}>
                          {vkDiff >= 0 ? '+' : ''}{vkDiff} VK Diff.
                        </p>
                      </div>
                    </div>

                    {/* Mini PG-Bars */}
                    <div className="grid grid-cols-4 gap-1">
                      {pgBars.map(pg => (
                        <div key={pg.label} className="text-center">
                          <div className="h-6 bg-slate-100 rounded-sm overflow-hidden flex items-end mb-0.5">
                            <div className={`w-full rounded-sm ${barColor}`}
                              style={{ height: `${Math.round((pg.val/pgMax)*100)}%` }} />
                          </div>
                          <span className="text-xs text-slate-400">{pg.label}: {pg.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}