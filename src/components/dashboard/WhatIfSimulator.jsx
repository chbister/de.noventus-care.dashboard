import React, { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Sliders, Loader2, ArrowRight, Users, Wallet, BedDouble, TrendingUp } from 'lucide-react';

export default function WhatIfSimulator() {
  const { selectedEinrichtung } = useEinrichtung();
  const [base, setBase] = useState(null);
  const [loading, setLoading] = useState(true);

  // Simulator inputs
  const [newPG2, setNewPG2] = useState(0);
  const [newPG3, setNewPG3] = useState(0);
  const [newPG4, setNewPG4] = useState(0);
  const [newPG5, setNewPG5] = useState(0);
  const [fehlzeitenChange, setFehlzeitenChange] = useState(0);
  const [sachkostenChange, setSachkostenChange] = useState(0);

  useEffect(() => {
    if (!selectedEinrichtung) { setLoading(false); return; }
    setLoading(true);
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    Promise.all([
      base44.entities.Wohnbereich.filter({ einrichtung_id: selectedEinrichtung.id }),
      base44.entities.Mitarbeiter.filter({ einrichtung_id: selectedEinrichtung.id, aktiv: true }),
      base44.entities.SachkostenAusgaben.filter({ einrichtung_id: selectedEinrichtung.id, leistungsmonat: currentMonth }),
    ]).then(([wb, ma, ausg]) => {
      const e = selectedEinrichtung;
      const pg2 = wb.reduce((s, w) => s + (w.belegung_pg2||0), 0);
      const pg3 = wb.reduce((s, w) => s + (w.belegung_pg3||0), 0);
      const pg4 = wb.reduce((s, w) => s + (w.belegung_pg4||0), 0);
      const pg5 = wb.reduce((s, w) => s + (w.belegung_pg5||0), 0);
      const bewohner = wb.reduce((s, w) =>
        s + (w.belegung_pg1||0)+(w.belegung_pg2||0)+(w.belegung_pg3||0)+(w.belegung_pg4||0)+(w.belegung_pg5||0)+(w.belegung_ruestige||0)+(w.belegung_pg0||0), 0);
      const sollPlaetze = wb.reduce((s, w) => s + (w.sollbelegung || 0), 0);
      const vkIst = ma.reduce((s, m) => s + (m.vk_pfk||0)+(m.vk_phk_mit_ausbildung||0)+(m.vk_phk_ohne_ausbildung||0), 0);
      const personalCosts = ma.reduce((s, m) => s + (m.monatsgehalt_brutto||0)+(m.sv_ag_anteil||0)+(m.funktionszulagen||0)+(m.zuschlaege_steuerfrei||0), 0);
      const sachkostenAktuell = ausg.filter(a => !a.ist_storniert).reduce((s, a) => s + (a.verwendeter_betrag||0), 0);

      // VK Soll (current)
      const sollFk = pg2*(e.schluessel_pg2_fk||0.1017) + pg3*(e.schluessel_pg3_fk||0.1521) + pg4*(e.schluessel_pg4_fk||0.2416) + pg5*(e.schluessel_pg5_fk||0.3768);
      const sollHkMit = pg2*(e.schluessel_pg2_hk_mit||0.0136) + pg3*(e.schluessel_pg3_hk_mit||0.0217) + pg4*(e.schluessel_pg4_hk_mit||0.0285) + pg5*(e.schluessel_pg5_hk_mit||0.0223);
      const sollHkOhne = pg2*(e.schluessel_pg2_hk_ohne||0.1173) + pg3*(e.schluessel_pg3_hk_ohne||0.1414) + pg4*(e.schluessel_pg4_hk_ohne||0.1588) + pg5*(e.schluessel_pg5_hk_ohne||0.1716);
      const vkSoll = Math.round((sollFk + sollHkMit + sollHkOhne) * 100) / 100;

      setBase({ pg2, pg3, pg4, pg5, bewohner, sollPlaetze, vkIst, vkSoll, personalCosts, sachkostenAktuell, einrichtung: e });
      setLoading(false);
    });
  }, [selectedEinrichtung]);

  const projection = useMemo(() => {
    if (!base) return null;
    const e = base.einrichtung;
    const newPg2 = base.pg2 + newPG2;
    const newPg3 = base.pg3 + newPG3;
    const newPg4 = base.pg4 + newPG4;
    const newPg5 = base.pg5 + newPG5;
    const newBewohner = base.bewohner + newPG2 + newPG3 + newPG4 + newPG5;

    // New VK Soll
    const newSollFk = newPg2*(e.schluessel_pg2_fk||0.1017) + newPg3*(e.schluessel_pg3_fk||0.1521) + newPg4*(e.schluessel_pg4_fk||0.2416) + newPg5*(e.schluessel_pg5_fk||0.3768);
    const newSollHkMit = newPg2*(e.schluessel_pg2_hk_mit||0.0136) + newPg3*(e.schluessel_pg3_hk_mit||0.0217) + newPg4*(e.schluessel_pg4_hk_mit||0.0285) + newPg5*(e.schluessel_pg5_hk_mit||0.0223);
    const newSollHkOhne = newPg2*(e.schluessel_pg2_hk_ohne||0.1173) + newPg3*(e.schluessel_pg3_hk_ohne||0.1414) + newPg4*(e.schluessel_pg4_hk_ohne||0.1588) + newPg5*(e.schluessel_pg5_hk_ohne||0.1716);
    const newVkSoll = Math.round((newSollFk + newSollHkMit + newSollHkOhne) * 100) / 100;

    // Personnel costs projection (based on cost per VK)
    const costPerVk = base.vkIst > 0 ? base.personalCosts / base.vkIst : 0;
    const newPersonalCosts = Math.round(newVkSoll * costPerVk);
    const personalDiff = newPersonalCosts - base.personalCosts;

    // VK Ist adjusted by Fehlzeiten change
    const newVkIst = Math.round((base.vkIst * (1 - fehlzeitenChange / 100)) * 100) / 100;

    // Sachkosten projection (based on real current Sachkosten + bewohner ratio + manual adjustment)
    const sachkostenProBewohner = base.bewohner > 0 ? base.sachkostenAktuell / base.bewohner : 0;
    const newSachkosten = Math.round((newBewohner * sachkostenProBewohner) * (1 + sachkostenChange / 100));

    // Auslastung
    const newAuslastung = base.sollPlaetze > 0 ? Math.round((newBewohner / base.sollPlaetze) * 100) : 0;

    // VK Deckung
    const vkDiff = Math.round((newVkIst - newVkSoll) * 100) / 100;

    return {
      newBewohner, newVkSoll, newVkIst, newPersonalCosts, personalDiff, newSachkosten, newAuslastung, vkDiff,
    };
  }, [base, newPG2, newPG3, newPG4, newPG5, fehlzeitenChange, sachkostenChange]);

  const formatEUR = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" /></div>;
  if (!base) return <div className="bg-white rounded-xl border p-8 text-center text-slate-400">Keine Daten verfügbar</div>;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">What-If Simulator</h2>
            <p className="text-sm text-emerald-100">Interaktive Szenarien: Was passiert, wenn sich Belegung, Fehlzeiten oder Kosten ändern?</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inputs */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Szenario anpassen</h3>

          {/* New Residents */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">Zusätzliche Bewohner pro Pflegegrad</p>
            <div className="grid grid-cols-4 gap-2">
              {[['PG2', newPG2, setNewPG2], ['PG3', newPG3, setNewPG3], ['PG4', newPG4, setNewPG4], ['PG5', newPG5, setNewPG5]].map(([label, val, set]) => (
                <div key={label} className="text-center">
                  <label className="text-xs text-slate-400">{label}</label>
                  <input type="number" value={val} onChange={e => set(Number(e.target.value) || 0)}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-center text-sm mt-1" />
                </div>
              ))}
            </div>
          </div>

          {/* Fehlzeiten */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-slate-600">Fehlzeiten-Änderung</label>
              <span className={`text-xs font-semibold ${fehlzeitenChange > 0 ? 'text-red-600' : fehlzeitenChange < 0 ? 'text-green-600' : 'text-slate-400'}`}>
                {fehlzeitenChange > 0 ? '+' : ''}{fehlzeitenChange}%
              </span>
            </div>
            <input type="range" min="-30" max="30" value={fehlzeitenChange} onChange={e => setFehlzeitenChange(Number(e.target.value))}
              className="w-full accent-teal-600" />
          </div>

          {/* Sachkosten */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-slate-600">Sachkosten-Änderung</label>
              <span className={`text-xs font-semibold ${sachkostenChange > 0 ? 'text-red-600' : sachkostenChange < 0 ? 'text-green-600' : 'text-slate-400'}`}>
                {sachkostenChange > 0 ? '+' : ''}{sachkostenChange}%
              </span>
            </div>
            <input type="range" min="-30" max="30" value={sachkostenChange} onChange={e => setSachkostenChange(Number(e.target.value))}
              className="w-full accent-teal-600" />
          </div>

          <button onClick={() => { setNewPG2(0); setNewPG3(0); setNewPG4(0); setNewPG5(0); setFehlzeitenChange(0); setSachkostenChange(0); }}
            className="text-xs text-slate-500 hover:text-slate-700">Zurücksetzen</button>
        </div>

        {/* Results */}
        <div className="space-y-3">
          <ResultCard
            icon={BedDouble} iconBg="bg-teal-50" iconColor="text-teal-600"
            label="Bewohner" current={base.bewohner} projected={projection.newBewohner}
            format={(v) => `${v}`}
            sub={`Auslastung: ${base.bewohner > 0 ? Math.round(base.bewohner / base.sollPlaetze * 100) : 0}% → ${projection.newAuslastung}%`}
          />
          <ResultCard
            icon={Users} iconBg="bg-blue-50" iconColor="text-blue-600"
            label="VK Soll (Personalbedarf)" current={base.vkSoll} projected={projection.newVkSoll}
            format={(v) => `${v} VK`}
            sub={`VK Ist: ${base.vkIst} → ${projection.newVkIst} ${projection.vkDiff >= 0 ? '(+ Deckung)' : '(Unterdeckung!)'}`}
            negative={projection.vkDiff < 0}
          />
          <ResultCard
            icon={Wallet} iconBg="bg-orange-50" iconColor="text-orange-600"
            label="Personalkosten/Monat" current={base.personalCosts} projected={projection.newPersonalCosts}
            format={formatEUR}
            sub={`${projection.personalDiff >= 0 ? '+' : ''}${formatEUR(projection.personalDiff)} pro Monat`}
            negative={projection.personalDiff > 0}
          />
          <ResultCard
            icon={TrendingUp} iconBg="bg-violet-50" iconColor="text-violet-600"
            label="Sachkosten/Monat" current={base.sachkostenAktuell} projected={projection.newSachkosten}
            format={formatEUR}
            sub={`Bewohner-Änderung: +${newPG2 + newPG3 + newPG4 + newPG5}`}
          />
        </div>
      </div>
    </div>
  );
}

function ResultCard({ icon: Icon, iconBg, iconColor, label, current, projected, format, sub, negative }) {
  const diff = projected - current;
  const diffStr = diff > 0 ? `+${format(diff)}` : format(diff);
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <div className="ml-auto flex items-center gap-1.5 text-xs">
          <span className="text-slate-400">{format(current)}</span>
          <ArrowRight className="w-3 h-3 text-slate-300" />
          <span className={`font-bold ${negative ? 'text-red-600' : 'text-slate-900'}`}>{format(projected)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className={`px-1.5 py-0.5 rounded font-medium ${diff > 0 ? (negative ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600') : diff < 0 ? (negative ? 'bg-green-50 text-green-600' : 'bg-green-50 text-green-600') : 'bg-slate-100 text-slate-500'}`}>
          {diffStr}
        </span>
        <span className="text-slate-400">{sub}</span>
      </div>
    </div>
  );
}