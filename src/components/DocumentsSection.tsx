'use client';

import { useState, useEffect } from 'react';
import { VehicleDocument, DOC_CHECKLIST, DOC_STAGE_LABELS, calcDocProgress } from '@/lib/types';
import { Upload, Trash2, Eye, Loader2, FileText, ScanLine, CheckCircle2, Plus } from 'lucide-react';

const STATUS_TRIGGERS: Record<string, string> = {
  bl:              'בספינה',
  delivery_order:  'הגיע לנמל',
  customs_release: 'שוחרר',
  noise_test:      'רישוי',
  inspection:      'רישוי',
  mandatory_ins:   'רישוי',
};

const STAGE_ORDER: Array<keyof typeof DOC_STAGE_LABELS> = ['purchase', 'shipping', 'customs', 'licensing'];

interface Props {
  vehicleId: number;
  onStatusChange?: (newStatus: string) => void;
}

export default function DocumentsSection({ vehicleId, onStatusChange }: Props) {
  const [docs, setDocs] = useState<VehicleDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [uploadType, setUploadType] = useState('other');
  const [statusMsg, setStatusMsg] = useState('');

  async function load() {
    const res = await fetch(`/api/vehicles/${vehicleId}/documents`);
    if (res.ok) setDocs(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [vehicleId]);

  async function triggerStatusUpdate(type: string) {
    const newStatus = STATUS_TRIGGERS[type];
    if (!newStatus) return;
    const res = await fetch(`/api/vehicles/${vehicleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _statusOnly: true, status: newStatus }),
    });
    if (res.ok) {
      setStatusMsg(`סטטוס עודכן אוטומטית ← ${newStatus}`);
      setTimeout(() => setStatusMsg(''), 4000);
      onStatusChange?.(newStatus);
    }
  }

  async function uploadFile(file: File, type: string) {
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('doc_type', type);
    const res = await fetch(`/api/vehicles/${vehicleId}/documents`, { method: 'POST', body: fd });
    if (res.ok) {
      await load();
      setShowAdd(false);
      await triggerStatusUpdate(type);
    }
    setUploading(false);
  }

  async function scanAndUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    const scanFd = new FormData();
    scanFd.append('file', file);
    let detectedType = uploadType;
    try {
      const res = await fetch('/api/parse-document', { method: 'POST', body: scanFd });
      if (res.ok) {
        const data = await res.json();
        if (data._doc_type) detectedType = data._doc_type;
      }
    } catch {}
    setScanning(false);
    await uploadFile(file, detectedType);
    e.target.value = '';
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file, uploadType);
    e.target.value = '';
  }

  async function deleteDoc(id: number) {
    if (!confirm('למחוק מסמך זה?')) return;
    await fetch(`/api/vehicles/${vehicleId}/documents/${id}`, { method: 'DELETE' });
    setDocs(d => d.filter(doc => doc.id !== id));
  }

  const progress = calcDocProgress(docs);

  const progressColor = progress.pct === 100 ? 'from-emerald-400 to-emerald-500'
    : progress.pct >= 60 ? 'from-blue-400 to-blue-500'
    : progress.pct >= 30 ? 'from-amber-400 to-orange-400'
    : 'from-red-400 to-red-500';

  if (loading) return <div className="text-sm text-gray-400 text-center py-4">טוען מסמכים...</div>;

  const docsByStage = STAGE_ORDER.map(stage => ({
    stage,
    label: DOC_STAGE_LABELS[stage],
    docs: docs.filter(d => DOC_CHECKLIST.find(c => c.type === d.doc_type)?.stage === stage
      || (stage === 'purchase' && !DOC_CHECKLIST.find(c => c.type === d.doc_type))),
  })).filter(s => s.docs.length > 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-500" /> מסמכים
        </h2>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-semibold">
          <Plus className="w-3.5 h-3.5" /> הוסף מסמך
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Progress */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-gray-600">השלמת מסמכים חובה</span>
            <span className={`text-sm font-black ${progress.pct === 100 ? 'text-emerald-600' : 'text-gray-800'}`}>
              {progress.done}/{progress.total}
              <span className="text-xs font-semibold text-gray-400 mr-1">({progress.pct}%)</span>
            </span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full bg-gradient-to-l transition-all duration-700 ${progressColor}`}
              style={{ width: `${progress.pct}%` }} />
          </div>
        </div>

        {/* Auto-status notification */}
        {statusMsg && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-2.5 rounded-xl font-medium">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" /> {statusMsg}
          </div>
        )}

        {/* Add panel */}
        {showAdd && (
          <div className="border border-blue-100 bg-blue-50/60 rounded-2xl p-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">סוג מסמך</label>
              <select value={uploadType} onChange={e => setUploadType(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                {DOC_CHECKLIST.map(d => <option key={d.type} value={d.type}>{d.label}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <label className={`flex-1 flex items-center justify-center gap-2 cursor-pointer py-3 rounded-xl text-sm font-semibold border-2 border-dashed transition-colors ${uploading ? 'border-gray-200 text-gray-400 cursor-not-allowed' : 'border-blue-300 text-blue-700 hover:border-blue-500 hover:bg-blue-100'}`}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'מעלה...' : 'העלה קובץ'}
                <input type="file" accept="image/*,.pdf" className="hidden" disabled={uploading || scanning} onChange={handleUpload} />
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 cursor-pointer py-3 rounded-xl text-sm font-semibold transition-colors ${scanning ? 'bg-purple-400 text-white cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                {scanning ? 'סורק...' : 'סרוק + העלה'}
                <input type="file" accept="image/*,.pdf" className="hidden" disabled={uploading || scanning} onChange={scanAndUpload} />
              </label>
            </div>
          </div>
        )}

        {/* Uploaded docs */}
        {docs.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">אין מסמכים עדיין — לחץ &quot;הוסף מסמך&quot;</p>
          </div>
        ) : (
          <div className="space-y-5">
            {docsByStage.map(({ stage, label, docs: stageDocs }) => (
              <div key={stage}>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="h-px flex-1 bg-gray-100" />
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{label}</h3>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>
                <div className="space-y-2">
                  {stageDocs.map(doc => {
                    const checklistItem = DOC_CHECKLIST.find(c => c.type === doc.doc_type);
                    const docLabel = checklistItem?.label || doc.doc_type;
                    return (
                      <div key={doc.id}
                        className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">
                        <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-gray-800 block">{docLabel}</span>
                          <span className="text-xs text-gray-400 truncate block">
                            {doc.file_name.length > 35 ? doc.file_name.slice(0, 33) + '…' : doc.file_name}
                          </span>
                        </div>
                        <a href={`/api/vehicles/${vehicleId}/documents/${doc.id}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50">
                          <Eye className="w-4 h-4" />
                        </a>
                        <button onClick={() => deleteDoc(doc.id)}
                          className="text-gray-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
