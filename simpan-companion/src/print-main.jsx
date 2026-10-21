import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { PrintLayout } from './components/PrintManager';

const JOB_KEY = 'simpan_print_job';

const loadJob = () => {
  try {
    const raw = localStorage.getItem(JOB_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

function PrintPage() {
  const [job] = useState(loadJob);

  useEffect(() => {
    if (!job) return;
    document.title = `Cetak APOS - ${job.record?.name || ''}`;

    // Ukuran kertas harus sama dengan pilihan (A5 / A4)
    const style = document.createElement('style');
    style.textContent = `
      @page { size: ${job.paperSize} portrait; margin: 0.5cm; }
      html, body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @media print {
        html, body { height: auto !important; margin: 0 !important; }
        .no-print { display: none !important; }
        #print-root { min-height: 0 !important; background: white !important; }
        #print-wrapper { max-width: 100% !important; margin: 0 !important; box-shadow: none !important; padding: 0 !important; }
      }
    `;
    document.head.appendChild(style);

    // Tunggu font + 2 frame render supaya style Tailwind sudah terpasang sebelum dialog cetak muncul
    let cancelled = false;
    (async () => {
      try { await document.fonts?.ready; } catch {}
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise(r => setTimeout(r, 300));
      if (!cancelled) window.print();
    })();

    return () => { cancelled = true; };
  }, [job]);

  if (!job) {
    return (
      <div className="p-6 text-sm">
        Data cetak tidak ditemukan. Tutup tab ini dan coba cetak lagi dari SIMPAN Companion.
      </div>
    );
  }

  const maxW = job.paperSize === 'A4' ? '210mm' : '148mm';

  return (
    <div id="print-root" className="min-h-screen bg-slate-100 print:bg-white">
      <div className="no-print sticky top-0 z-50 flex items-center justify-between bg-white border-b-2 border-slate-200 px-4 py-3">
        <div className="font-black text-sm text-blue-900">🖨️ Preview Cetak APOS ({job.paperSize})</div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-md">🖨️ Cetak Sekarang</button>
          <button onClick={() => window.close()} className="bg-red-500 text-white font-bold text-xs px-4 py-2 rounded-md">✕ Tutup</button>
        </div>
      </div>

      <div id="print-wrapper" className="mx-auto my-4 bg-white p-3 shadow-lg" style={{ maxWidth: maxW }}>
        <PrintLayout record={job.record} includeCpoSchedule={!!job.includeCpo} />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<PrintPage />);