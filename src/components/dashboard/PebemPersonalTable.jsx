import React from 'react';
import { Calculator, TrendingUp, TrendingDown, Check } from 'lucide-react';

/**
 * PeBeM-Personalschlüssel-Tabelle
 * Zeigt den Personalbedarf nach Pflegegraden aufgeschlüsselt.
 */
export default function PebemPersonalTable({ wohnbereiche, einrichtung, istFk, istHkMit, istHkOhne }) {
  const e = einrichtung || {};

  // Bewohner pro PG aggregieren (inkl. geplante)
  const pg2 = wohnbereiche.reduce((s, w) => s + (w.belegung_pg2 || 0) + (w.geplant_pg2 || 0), 0);
  const pg3 = wohnbereiche.reduce((s, w) => s + (w.belegung_pg3 || 0) + (w.geplant_pg3 || 0), 0);
  const pg4 = wohnbereiche.reduce((s, w) => s + (w.belegung_pg4 || 0) + (w.geplant_pg4 || 0), 0);
  const pg5 = wohnbereiche.reduce((s, w) => s + (w.belegung_pg5 || 0) + (w.geplant_pg5 || 0), 0);

  const r2 = (n) => Math.round(n * 100) / 100;

  // Schlüssel aus Einrichtung (mit PeBeM-Defaults)
  const keys = {
    PG2: { fk: e.schluessel_pg2_fk || 0.1017, hk_mit: e.schluessel_pg2_hk_mit || 0.0136, hk_ohne: e.schluessel_pg2_hk_ohne || 0.1173, bewohner: pg2 },
    PG3: { fk: e.schluessel_pg3_fk || 0.1521, hk_mit: e.schluessel_pg3_hk_mit || 0.0217, hk_ohne: e.schluessel_pg3_hk_ohne || 0.1414, bewohner: pg3 },
    PG4: { fk: e.schluessel_pg4_fk || 0.2416, hk_mit: e.schluessel_pg4_hk_mit || 0.0285, hk_ohne: e.schluessel_pg4_hk_ohne || 0.1588, bewohner: pg4 },
    PG5: { fk: e.schluessel_pg5_fk || 0.3768, hk_mit: e.schluessel_pg5_hk_mit || 0.0223, hk_ohne: e.schluessel_pg5_hk_ohne || 0.1716, bewohner: pg5 },
  };

  const rows = Object.entries(keys).map(([pg, k]) => ({
    pg,
    bewohner: k.bewohner,
    fkKey: k.fk,
    fkSoll: r2(k.bewohner * k.fk),
    hkMitKey: k.hk_mit,
    hkMitSoll: r2(k.bewohner * k.hk_mit),
    hkOhneKey: k.hk_ohne,
    hkOhneSoll: r2(k.bewohner * k.hk_ohne),
    gesamt: r2(k.bewohner * (k.fk + k.hk_mit + k.hk_ohne)),
  }));

  const sumFk = r2(rows.reduce((s, r) => s + r.fkSoll, 0));
  const sumHkMit = r2(rows.reduce((s, r) => s + r.hkMitSoll, 0));
  const sumHkOhne = r2(rows.reduce((s, r) => s + r.hkOhneSoll, 0));
  const sumGesamt = r2(sumFk + sumHkMit + sumHkOhne);

  const abwFk = r2(istFk - sumFk);
  const abwHkMit = r2(istHkMit - sumHkMit);
  const abwHkOhne = r2(istHkOhne - sumHkOhne);
  const abwGesamt = r2(istFk + istHkMit + istHkOhne - sumGesamt);

  const DiffBadge = ({ diff }) => {
    if (diff > 0) return <span className="inline-flex items-center gap-0.5 text-teal-600 font-medium"><TrendingUp className="w-3 h-3" />{`+${diff.toFixed(2)}`}</span>;
    if (diff < 0) return <span className="inline-flex items-center gap-0.5 text-red-500 font-medium"><TrendingDown className="w-3 h-3" />{diff.toFixed(2)}</span>;
    return <span className="inline-flex items-center gap-0.5 text-slate-400"><Check className="w-3 h-3" />0,00</span>;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-4 h-4 text-teal-600" />
        <h2 className="font-semibold text-slate-900">PeBeM-Personalschlüssel</h2>
        <span className="text-xs text-slate-400">nach Pflegegrad aufgeschlüsselt</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-600">
              <th className="px-3 py-2 font-medium">Pflegegrad</th>
              <th className="px-3 py-2 font-medium text-right">Bewohner</th>
              <th className="px-3 py-2 font-medium text-right">FK-Schlüssel</th>
              <th className="px-3 py-2 font-medium text-right">FK Soll</th>
              <th className="px-3 py-2 font-medium text-right">HK m.A. Schlüssel</th>
              <th className="px-3 py-2 font-medium text-right">HK m.A. Soll</th>
              <th className="px-3 py-2 font-medium text-right">HK o.A. Schlüssel</th>
              <th className="px-3 py-2 font-medium text-right">HK o.A. Soll</th>
              <th className="px-3 py-2 font-medium text-right">Gesamt Soll</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(r => (
              <tr key={r.pg} className="hover:bg-slate-50/50">
                <td className="px-3 py-2 font-semibold text-slate-800">{r.pg}</td>
                <td className="px-3 py-2 text-right text-slate-700">{r.bewohner}</td>
                <td className="px-3 py-2 text-right text-slate-400">{r.fkKey.toFixed(4)}</td>
                <td className="px-3 py-2 text-right text-slate-700 font-medium">{r.fkSoll.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-slate-400">{r.hkMitKey.toFixed(4)}</td>
                <td className="px-3 py-2 text-right text-slate-700 font-medium">{r.hkMitSoll.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-slate-400">{r.hkOhneKey.toFixed(4)}</td>
                <td className="px-3 py-2 text-right text-slate-700 font-medium">{r.hkOhneSoll.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-slate-900 font-bold">{r.gesamt.toFixed(2)}</td>
              </tr>
            ))}
            {/* Summe Soll */}
            <tr className="bg-slate-100 font-semibold">
              <td className="px-3 py-2 text-slate-800">Soll gesamt</td>
              <td className="px-3 py-2 text-right text-slate-600">{pg2 + pg3 + pg4 + pg5}</td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right text-slate-800">{sumFk.toFixed(2)}</td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right text-slate-800">{sumHkMit.toFixed(2)}</td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right text-slate-800">{sumHkOhne.toFixed(2)}</td>
              <td className="px-3 py-2 text-right text-slate-900">{sumGesamt.toFixed(2)}</td>
            </tr>
            {/* Ist */}
            <tr className="bg-teal-50/50 font-semibold">
              <td className="px-3 py-2 text-teal-700">Ist (VK)</td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right text-teal-700">{istFk.toFixed(2)}</td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right text-teal-700">{istHkMit.toFixed(2)}</td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right text-teal-700">{istHkOhne.toFixed(2)}</td>
              <td className="px-3 py-2 text-right text-teal-700">{(istFk + istHkMit + istHkOhne).toFixed(2)}</td>
            </tr>
            {/* Abweichung */}
            <tr className="font-medium">
              <td className="px-3 py-2 text-slate-500">Abweichung</td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right"><DiffBadge diff={abwFk} /></td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right"><DiffBadge diff={abwHkMit} /></td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right"><DiffBadge diff={abwHkOhne} /></td>
              <td className="px-3 py-2 text-right"><DiffBadge diff={abwGesamt} /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}