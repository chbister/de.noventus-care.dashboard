import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { FolderOpen, Save, Check, Loader2, ExternalLink } from 'lucide-react';

export default function SharePointEinstellungen() {
  const [folder, setFolder] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setFolder(u?.sharepoint_folder || '');
      setSiteUrl(u?.sharepoint_site_url || '');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await base44.auth.updateMe({
        sharepoint_folder: folder.trim(),
        sharepoint_site_url: siteUrl.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-blue-100 rounded-lg">
          <FolderOpen className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900">SharePoint-Ordner</h2>
          <p className="text-xs text-slate-500">Persönlicher Ablageort für Monatsabschluss-PDFs</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">SharePoint-Seite (URL)</label>
          <input
            value={siteUrl}
            onChange={e => setSiteUrl(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="z.B. https://noventuscare.sharepoint.com/sites/Controlling"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Ordner-Pfad</label>
          <input
            value={folder}
            onChange={e => setFolder(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="z.B. /Monatsabschlüsse/2026"
          />
          <p className="text-xs text-slate-400 mt-1">
            Die generierten PDFs werden beim Monatsabschluss in diesen Ordner hochgeladen.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Speichert...' : saved ? 'Gespeichert!' : 'Speichern'}
        </button>
        {siteUrl && (
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            SharePoint öffnen
          </a>
        )}
      </div>
    </div>
  );
}