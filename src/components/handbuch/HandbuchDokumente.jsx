import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, FileText, Trash2, Download, Loader2, Plus, X } from 'lucide-react';

const KATEGORIEN = ['MediFox', 'DATEV', 'Anleitung', 'Sonstiges'];

export default function HandbuchDokumente() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titel: '', kategorie: 'MediFox', bemerkung: '', file_url: '', dateiname: '' });
  const [filterKat, setFilterKat] = useState('alle');

  const load = () => {
    setLoading(true);
    base44.entities.HandbuchDokumente.list('-created_date', 100)
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(p => ({ ...p, file_url, dateiname: file.name, titel: p.titel || file.name.replace(/\.pdf$/i, '') }));
    } catch (err) {
      alert('Upload fehlgeschlagen: ' + (err?.message || 'Unbekannter Fehler'));
    }
    setUploading(false);
  };

  const save = async () => {
    if (!form.titel || !form.file_url) return;
    await base44.entities.HandbuchDokumente.create(form);
    setForm({ titel: '', kategorie: 'MediFox', bemerkung: '', file_url: '', dateiname: '' });
    setShowForm(false);
    load();
  };

  const del = async (id) => {
    if (!confirm('Dokument löschen?')) return;
    await base44.entities.HandbuchDokumente.delete(id);
    load();
  };

  const filtered = filterKat === 'alle' ? docs : docs.filter(d => d.kategorie === filterKat);

  const isPdf = (url) => /\.pdf$/i.test(url || '');

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6 print:hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-900">Dokumente & PDFs</h2>
        </div>
        <button onClick={() => setShowForm(p => !p)}
          className="flex items-center gap-2 bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700">
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? 'Abbrechen' : 'PDF hinzufügen'}
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Titel *</label>
              <input value={form.titel} onChange={e => setForm(p => ({ ...p, titel: e.target.value }))}
                placeholder="z.B. MediFox Abrechnungsanleitung"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Kategorie</label>
              <select value={form.kategorie} onChange={e => setForm(p => ({ ...p, kategorie: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Bemerkung</label>
            <input value={form.bemerkung} onChange={e => setForm(p => ({ ...p, bemerkung: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">PDF-Datei *</label>
            <input type="file" accept="application/pdf,.pdf" onChange={handleFile}
              className="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-200 file:text-slate-700 file:font-medium file:cursor-pointer hover:file:bg-slate-300" />
            {uploading && <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Wird hochgeladen…</p>}
            {form.dateiname && !uploading && <p className="text-xs text-green-600 mt-1">✓ {form.dateiname}</p>}
          </div>
          <div className="flex justify-end">
            <button onClick={save} disabled={!form.titel || !form.file_url || uploading}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed">
              <Upload className="w-4 h-4" /> Speichern
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => setFilterKat('alle')}
          className={`px-3 py-1 rounded-full text-xs font-medium ${filterKat === 'alle' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          Alle ({docs.length})
        </button>
        {KATEGORIEN.map(k => {
          const count = docs.filter(d => d.kategorie === k).length;
          return (
            <button key={k} onClick={() => setFilterKat(k)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${filterKat === k ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {k} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <FileText className="w-8 h-8 mx-auto mb-2 text-slate-200" />
          <p className="text-sm">Noch keine Dokumente vorhanden.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(d => (
            <div key={d.id} className="group border border-slate-200 rounded-xl p-3 hover:shadow-sm transition-all">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{d.titel}</p>
                  <p className="text-xs text-slate-400 truncate">{d.dateiname || d.kategorie}</p>
                  {d.bemerkung && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{d.bemerkung}</p>}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                <span className="text-xs text-slate-400">{d.kategorie}</span>
                <div className="flex gap-1">
                  <a href={d.file_url} target="_blank" rel="noopener noreferrer" download
                    className="p-1.5 rounded text-slate-400 hover:bg-slate-100 hover:text-teal-600" title="Öffnen / Herunterladen">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => del(d.id)}
                    className="p-1.5 rounded text-slate-400 hover:bg-slate-100 hover:text-red-500" title="Löschen">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}