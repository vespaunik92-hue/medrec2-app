import React, { useMemo } from 'react';
import { ANTIBIOTICS_DB, LAB_PATTERNS, LAB_NORMAL_RANGES } from '../constants';
import { parsePlanning, getAntibioticDay } from '../utils/helpers';

// --- FUNGSI HELPER UNTUK PRINT DI HP/TABLET (ANTI-CRASH) ---
export const cetakPWA = (htmlContent, title = 'Cetak') => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<title>${title}</title>` + htmlContent);
    doc.close();

    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 3000);
    }, 800);
};

// --- FUNGSI UTAMA ENGINE JENDELA WINDOW PRINT ---
export const handlePrintWindow = (elementId, title, paperSize = 'A5') => {
    const content = document.getElementById(elementId);
    if (!content) return;

    const html = `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                body { background-color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: ${paperSize === 'A4' ? '12pt' : '11pt'}; }
                @media print { 
                    @page { size: ${paperSize} portrait; margin: 0.5cm; } 
                    body { margin: 0; } 
                    .no-print { display: none !important; } 
                    .print-break { page-break-after: always; } 
                    #print-container { width: 100%; max-width: ${paperSize === 'A4' ? '210mm' : '148mm'}; margin: 0 auto; } 
                }
            </style>
        </head>
        <body>
            <div id="print-container">${content.innerHTML}</div>
        </body>
        </html>
    `;
    cetakPWA(html, title);
};

// ✨ ULTIMATE TIME ENGINE: OTOMATIS MENGHITUNG HARI SECARA DINAMIS [HARI INI / NAMA HARI / TERLEWAT]
export const autoSmartDateTransformer = (text) => {
    if (!text) return '';

    const lines = text.split('\n');
    let currentSection = 'GENERAL'; // Melacak blok seksi (LAB, RAD, TNDKN, MEDS)

    const processedLines = lines.map(line => {
        const trimmed = line.trim();
        const lower = trimmed.toLowerCase();

        // 🕵️‍♂️ Detect Header Seksi
        if (lower.includes('lab:') || lower.includes('laboratorium') || trimmed.startsWith('🔬')) {
            currentSection = 'ACTIONABLE';
        } else if (lower.includes('rad:') || lower.includes('radiologi') || trimmed.startsWith('🩻')) {
            currentSection = 'ACTIONABLE';
        } else if (lower.includes('tndkn:') || lower.includes('tindakan') || trimmed.startsWith('💉')) {
            currentSection = 'ACTIONABLE';
        } else if (lower.includes('terapi:') || lower.includes('resep') || lower.includes('obat:') || trimmed.startsWith('💊') || trimmed.startsWith('💉 TERAPI')) {
            currentSection = 'MEDS';
        }

        // Cek apakah baris ini adalah item tindakan (Lab/Rad/Tindakan)
        const isActionableItem = 
            currentSection === 'ACTIONABLE' || 
            /\b(lab|rad|radiologi|tndkn|tindakan)\b/i.test(trimmed) ||
            /^(🔬|🩻|💉|🧪)/.test(trimmed);

        // Eksekusi Transformasi Tanggal
        return line.replace(/\[([^\]]*?)(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})([^\]]*?)\]/g, (match, prefix, dayStr, monthStr, yearStr, suffix) => {
            const day = parseInt(dayStr, 10);
            const month = parseInt(monthStr, 10) - 1;
            let year = parseInt(yearStr, 10);
            if (year < 100) year += 2000; 

            const targetDate = new Date(year, month, day);
            const today = new Date();

            const tDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
            const oDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

            const diffTime = tDate.getTime() - oDate.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const targetDayName = dayNames[targetDate.getDay()];

            let relativeLabel = '';
            if (diffDays === 0) {
                relativeLabel = 'Hari Ini';
            } else if (diffDays > 0) {
                relativeLabel = targetDayName;
            } else if (diffDays < 0) {
                // 🚨 LOGIKA SMART: Jika masa lalu, hanya beri label "Terlewat" jika ini item Lab/Rad/Tindakan!
                if (isActionableItem) {
                    relativeLabel = `Terlewat (${targetDayName})`;
                } else {
                    // Untuk obat & terapi rutin: Hapus total tag terlewatnya agar 'Clean Look'
                    return ''; 
                }
            }

            let timeModifier = '';
            const cleanPrefix = prefix.toLowerCase();
            if (cleanPrefix.includes('pagi')) timeModifier = ' Pagi';
            else if (cleanPrefix.includes('siang')) timeModifier = ' Siang';
            else if (cleanPrefix.includes('sore')) timeModifier = ' Sore';
            else if (cleanPrefix.includes('malam')) timeModifier = ' Malam';

            return `[${relativeLabel}${timeModifier}, ${dayStr}/${monthStr}/${yearStr.slice(-2)}]`;
        });
    });

    return processedLines.join('\n');
};

export const formatTextToHariIni = (text, rec) => autoSmartDateTransformer(text);

// ✨ MESIN PEMBACA & PEWARNA OTOMATIS (O) OBJEKTIF
export const FormattedObjective = ({ text }) => {
    if (!text) return <span>-</span>;
    const lines = text.split('\n');

    return (
        <div className="whitespace-pre-wrap">
            {lines.map((line, idx) => {
                const trimmedLine = line.trim();
                const lowerLine = trimmedLine.toLowerCase();

                if (/^\[[A-Za-z0-9\s]+,\s*\d{1,2}\/\d{1,2}.*\]$/.test(trimmedLine)) {
                    return (
                        <div key={idx} className="text-[10px] font-extrabold text-indigo-500 border-b border-indigo-100 pb-0.5 mt-1.5 mb-1 first:mt-0">
                            🕒 {trimmedLine}
                        </div>
                    );
                }

                if (/lacak\/lapor/i.test(lowerLine)) {
                    return (
                        <div key={idx} className="bg-amber-50 text-amber-800 border-2 border-amber-200 rounded-lg p-2 font-bold my-1 flex items-center gap-1.5 text-[11px] leading-tight shadow-sm" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                            <span>⚠️</span>
                            <span>{trimmedLine.replace(/^⚠️\s*/i, '')}</span>
                        </div>
                    );
                }

                let abnormalType = null;
                for (const [key, pattern] of Object.entries(LAB_PATTERNS || {})) {
                    if (typeof pattern !== 'object' || !pattern.test) continue;
                    const match = trimmedLine.match(pattern);
                    if (match && match[1]) {
                        const valStr = match[1].trim();
                        const range = LAB_NORMAL_RANGES[key];
                        const num = parseFloat(valStr.replace(',', '.'));
                        if (!isNaN(num) && range) {
                            if (num > range.max) abnormalType = 'high';
                            else if (num < range.min) abnormalType = 'low';
                            break;
                        }
                    }
                }

                if (!abnormalType) {
                    const isDanger = /(positif|reaktif|detected|ditemukan|resistan)/i.test(lowerLine);
                    const isSafe = /(negatif|non[- ]?reaktif|not detected|tidak ditemukan)/i.test(lowerLine);
                    if (isDanger && !isSafe) abnormalType = 'text-bad';
                }

                let spanClass = ""; let arrow = "";
                if (abnormalType === 'high') { spanClass = "text-red-600 font-bold bg-red-50 px-1 rounded inline-block shadow-sm"; arrow = " ⬆️"; }
                else if (abnormalType === 'low') { spanClass = "text-blue-600 font-bold bg-blue-50 px-1 rounded inline-block shadow-sm"; arrow = " ⬇️"; }
                else if (abnormalType === 'text-bad') { spanClass = "text-red-600 font-bold bg-red-50 px-1 rounded inline-block shadow-sm"; arrow = " ⚠️"; }

                return (
                    <span key={idx}>
                        <span className={spanClass}>{line}{arrow}</span>
                        {idx !== lines.length - 1 && <br />}
                    </span>
                );
            })}
        </div>
    );
};

// 🧠 ENGINE: MENGELOMPOKKAN ITEM CETAK LAB & RAD DI KERTAS APOS
const renderGroupedItemsForPrint = (items, itemAuthors) => {
    const groups = {};
    items.forEach(item => {
        const match = item.match(/\[([^\]]+)\]/);
        const dateTag = match ? match[0] : '';
        const cleanName = match ? item.replace(match[0], '').trim() : item.trim();
        const polishedName = cleanName.replace(/^,|,$/g, '').trim();

        if (!groups[dateTag]) groups[dateTag] = [];
        groups[dateTag].push({ original: item, clean: polishedName });
    });

    return Object.entries(groups).map(([dateTag, entries], idx) => {
        const content = entries.map((entry, eIdx) => {
            const authors = itemAuthors?.[entry.original] || [];
            return (
                <span key={eIdx}>
                    {eIdx > 0 && ', '}
                    {entry.clean}
                    {authors.length > 1 && (
                        <span className="font-normal text-[9px] opacity-70 normal-case">
                            {' '}({authors.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' & ')})
                        </span>
                    )}
                </span>
            );
        });

        return (
            <div key={idx} className="text-left font-bold block">
                • {content} {dateTag}
            </div>
        );
    });
};

// ✨ MULTIUSER & ANTIBIOTIK LAYER RUNTIME RENDER (SEJAJAR SEMPURNA DENGAN BADGE SISA LABU)
const renderItemsWithAuthors = (items = [], itemAuthors = {}, isRx = false, isStacked = false, record = {}) => {
    return items.map((rawItem, idx) => {
        // Ganti istilah 'ktg' / 'KTG' menjadi 'labu' untuk display
        const displayItem = typeof rawItem === 'string' 
            ? rawItem.replace(/\bktg\b/gi, 'labu') 
            : rawItem;

        const authors = itemAuthors[rawItem] || itemAuthors[displayItem] || [];
        let abBadge = null;

        // 1. Badge Hari Antibiotik
        if (isRx && typeof getAntibioticDay === 'function') {
            const cleanMedName = displayItem.split(/\s+\d/)[0].trim().replace(/\s+(iv|im|sc|po|drip)$/i, '');
            const hCode = getAntibioticDay(cleanMedName, record.medicationLogs || {});
            if (hCode) {
                abBadge = (
                    <span 
                        className="ml-1 text-[9px] font-bold text-black border border-black bg-gray-100 px-1 py-[1px] rounded"
                        style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                    >
                        🚨 {hCode}
                    </span>
                );
            }
        }

        // 2. 🧠 SENSOR HITUNG SISA LABU TRANSFUSI UNTUK CETAK APOS
        let trnfsBadge = null;
        const trnfsMatch = displayItem.match(/(?:trnfs|transfusi)\s+(\d+)\s+([a-zA-Z]+)(?:[,\s]+on\s*ke\s*(\d*))?(?:[,\s]+post\s*ke\s*(\d*))?(?:[,\s]+sisa\s*(\d*))?/i);
        
        if (trnfsMatch) {
            const total = parseInt(trnfsMatch[1], 10) || 0;
            const on = trnfsMatch[3] ? parseInt(trnfsMatch[3], 10) : 0;
            const post = trnfsMatch[4] ? parseInt(trnfsMatch[4], 10) : 0;
            
            let sisaLabu = trnfsMatch[5] !== undefined && trnfsMatch[5] !== '' 
                ? parseInt(trnfsMatch[5], 10) 
                : (on > 0 ? Math.max(0, total - on) : Math.max(0, total - post));

            trnfsBadge = (
                <span 
                    className="bg-purple-200 text-purple-950 border border-purple-300 px-1.5 py-0.2 rounded text-[8px] font-black shrink-0 ml-1.5 shadow-sm whitespace-nowrap"
                    style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                >
                    🩸 Sisa: {sisaLabu} labu
                </span>
            );
        }

        if (isStacked) {
            return (
                <div 
                    key={rawItem || idx} 
                    className={`flex items-center justify-between gap-1 w-full text-left font-bold ${idx > 0 ? "mt-0.5 border-t border-slate-300/40 pt-0.5" : ""}`}
                >
                    <span className="flex-1 min-w-0">
                        • {displayItem}
                        {abBadge}
                        {authors.length > 1 && (
                            <span className="font-normal text-[9px] opacity-70 normal-case">
                                {' '}({authors.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' & ')})
                            </span>
                        )}
                    </span>
                    {trnfsBadge}
                </div>
            );
        }

        return (
            <span key={rawItem || idx} className="inline-flex items-center justify-between w-full">
                <span>
                    • {displayItem}
                    {abBadge}
                    {authors.length > 1 && (
                        <span className="font-normal text-[9px] opacity-70 normal-case">
                            {' '}({authors.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' & ')})
                        </span>
                    )}
                </span>
                {trnfsBadge}
            </span>
        );
    });
};

const renderHighlightedOthers = (textArray) => {
    return textArray.map((line, idx) => {
        const lower = line.toLowerCase();
        
        // 1. Badge Pulang / BLPL
        const dischargeKeywords = ['blpl', 'rblpl', 'pulang', 'boleh pulang'];
        if (dischargeKeywords.some(k => lower.includes(k))) {
            return (
                <div 
                    key={idx} 
                    className="font-bold border border-black bg-gray-100 px-1.5 py-0.5 my-1 rounded text-black text-xs leading-tight w-fit flex items-center gap-1"
                    style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                >
                    🎉 {line.toUpperCase()}
                </div>
            );
        }

        // 2. Badge Pindah Kamar / Transfer / Rujuk
        const transferKeywords = ['pindah', 'transfer', 'rujuk', 'alih rawat', 'pindah kamar'];
        if (transferKeywords.some(k => lower.includes(k))) {
            return (
                <div 
                    key={idx} 
                    className="font-bold border border-indigo-400 bg-indigo-50 text-indigo-900 px-1.5 py-0.5 my-1 rounded text-xs leading-tight w-fit flex items-center gap-1"
                    style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                >
                    🚑 {line}
                </div>
            );
        }

        // 3. Badge Alert / Konsul / Lapor / Tindakan Cito
        const alertKeywords = ['lab', 'radiologi', 'rontgen', 'usg', 'ct-scan', 'cek darah', 'konsul', 'lapor', 'puasa', 'operasi', 'cito', 'hd'];
        if (alertKeywords.some(k => lower.includes(k))) {
            return (
                <div 
                    key={idx} 
                    className="font-bold border border-black bg-gray-100 px-1.5 py-0.5 my-1 rounded text-black text-xs leading-tight w-fit flex items-center gap-1"
                    style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                >
                    ⚠️ {line.toUpperCase()}
                </div>
            );
        }

        // 4. Catatan Umum Lainnya
        return <div key={idx} className="my-0.5">{line}</div>;
    });
};

export const PrintLayout = ({ record, historyLogs = [] }) => {
    if (!record) return null;

    const stripAuthorTags = (text) => (text || '').replace(/(?:🕒\s*)?\[[^\]]+,\s*[\d\/]+\s+[\d:]+\]\s*/g, '').trim();
    const safeSubjective = stripAuthorTags(record.subjective);
    const safeObjective = stripAuthorTags(record.objective);
    const safeAnalysis = stripAuthorTags(record.analysis);
    const safePlanning = stripAuthorTags(record.planning);

    const safeCurrentPrescription = (() => {
        if (record.currentPrescription && record.currentPrescription.trim()) return record.currentPrescription.trim();
        const legacyMatch = (record.planning || '').match(/\[RESEP OBAT\]:([\s\S]*)/i);
        return legacyMatch ? legacyMatch[1].trim() : '';
    })();

    const filteredPlanningForPrint = useMemo(() => {
        if (!safePlanning) return '';
        return safePlanning.split('\n').filter(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('-') && safeCurrentPrescription.toLowerCase().includes(trimmed.toLowerCase())) return false;
            return true;
        }).join('\n').trim();
    }, [safePlanning, safeCurrentPrescription]);

    const { others, labs, rads, tms, rxs, itemAuthors } = useMemo(() => {
        if (!filteredPlanningForPrint) return { others: [], labs: [], rads: [], tms: [], rxs: [], itemAuthors: {} };
        return parsePlanning(filteredPlanningForPrint);
    }, [filteredPlanningForPrint]);

    const hasSubjective = safeSubjective && safeSubjective !== '-' && safeSubjective.trim() !== '';

    const buildLabTable = () => {
        const allLogs = [{ objective: safeObjective, updatedAt: new Date() }, ...historyLogs.map(log => ({ objective: log.objective || '', updatedAt: log.updatedAt }))].filter(log => log.objective);
        const labData = {}; const dateSet = new Set();

        allLogs.forEach(log => {
            const dateObj = log.updatedAt && log.updatedAt.seconds ? new Date(log.updatedAt.seconds * 1000) : (log.updatedAt || new Date());
            const dateStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
            dateSet.add(dateStr);

            Object.keys(LAB_PATTERNS).forEach(key => {
                if (['TCM', 'HIV', 'HBsAg', 'Anti-HCV', 'Widal', 'Kultur', 'MDT'].includes(key)) return;
                const match = log.objective.match(LAB_PATTERNS[key]);
                if (match) {
                    if (!labData[key]) labData[key] = [];
                    labData[key].push({ date: dateStr, val: match[1] });
                }
            });
        });

        const headers = Array.from(dateSet).sort((a, b) => {
            const [d1, m1] = a.split('/'); const [d2, m2] = b.split('/');
            return new Date(2026, m2 - 1, d2) - new Date(2026, m1 - 1, d1);
        });

        const rows = {};
        Object.keys(LAB_PATTERNS).forEach(key => {
            if (['TCM', 'HIV', 'HBsAg', 'Anti-HCV', 'Widal', 'Kultur', 'MDT'].includes(key)) return;
            if (labData[key] && labData[key].length > 0) {
                rows[key] = {}; const seen = new Set();
                [...labData[key]].reverse().forEach(item => {
                    if (!seen.has(item.date)) { rows[key][item.date] = item; seen.add(item.date); }
                });
            }
        });
        return { headers, rows };
    };

    const { headers, rows } = buildLabTable();
    const displayLabs = labs.map(item => formatTextToHariIni(item, record));
    const displayRads = rads.map(item => formatTextToHariIni(item, record));
    const displayTms = tms.map(item => formatTextToHariIni(item, record));

    const displayItemAuthors = {};
    if (itemAuthors) {
        Object.keys(itemAuthors).forEach(key => {
            displayItemAuthors[formatTextToHariIni(key, record)] = itemAuthors[key];
        });
    }

    return (
        <div className="bg-white p-0 text-sm font-sans leading-snug text-black h-full flex flex-col">
            <div className="flex justify-between items-start border-b-2 border-black pb-1 mb-2 shrink-0">
                <div className="flex-1">
                    <div className="font-bold text-lg uppercase tracking-wide flex items-center gap-2">
                        <span className="text-sm font-bold border-2 border-black px-2 py-0.5">{record.roomNumber ? record.roomNumber.replace(/(KM|P)$/, '') : ''}</span>
                        <span>{record.name}</span>
                    </div>
                    <div className="text-[11px] mt-0.5 flex flex-wrap gap-x-4 items-center">
                        <span className="font-black text-[13px] bg-gray-200 px-1.5 py-0.5 rounded border border-gray-400" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>DPJP: {record.dpjpName}</span>
                        {(record.raberName || record.raber2Name) && <span className="text-gray-600 font-medium italic">Raber: {[record.raberName, record.raber2Name].filter(Boolean).join(', ')}</span>}
                    </div>
                </div>
                <div className="text-right flex flex-col items-end justify-start">
                    {record.admissionDate && (
                        <div className="text-[10px] text-gray-700 font-bold">
                            {(() => {
                                const start = new Date(record.admissionDate); if (isNaN(start)) return null;
                                const now = new Date(); const diffTime = now.getTime() - start.getTime(); if (diffTime < 0) return null;
                                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                return `${start.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })} - ${now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' })} = ${diffDays} hr ${diffHours} jm`;
                            })()}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 flex-1 items-stretch">
                <div className="border-r-2 border-gray-300 pr-2 flex flex-col">
                    <div className="mb-2">
                        <div className="font-bold underline mb-1 bg-gray-100 inline-block px-1 text-xs">A (ANALISA) / Dx :</div>
                        <div className="whitespace-pre-wrap font-sans mb-1 pl-1">{safeAnalysis || '-'}</div>
                    </div>
                    <div className="border-t-2 border-dashed border-gray-400 pt-2 mt-1">
                        <div className="font-bold underline mb-2 bg-gray-100 inline-block px-1 text-xs">P (PLANNING)</div>
                        <div className="font-sans pl-1">
                            {others.length > 0 && <div className="mb-3 leading-relaxed whitespace-pre-wrap">{renderHighlightedOthers(others)}</div>}
                            {(labs.length > 0 || rads.length > 0 || tms.length > 0 || rxs.length > 0) && (
                                <div className="space-y-1 mt-2 border-t border-dotted border-gray-400 pt-2 text-xs">
                                    {displayLabs.length > 0 && (
                                        <div className="flex items-start bg-rose-50 border border-rose-300 text-rose-900 px-1.5 py-1 rounded w-full leading-tight mb-1" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                            <span className="font-bold whitespace-nowrap flex-shrink-0 uppercase text-[10px] mr-1.5">🔬 R/LAB :</span>
                                            <div className="flex-1 font-bold underline">{renderGroupedItemsForPrint(displayLabs, displayItemAuthors)}</div>
                                        </div>
                                    )}
                                    {displayRads.length > 0 && (
                                        <div className="flex items-start bg-sky-50 border border-sky-300 text-sky-900 px-1.5 py-1 rounded w-full leading-tight mb-1" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                            <span className="font-bold whitespace-nowrap flex-shrink-0 uppercase text-[10px] mr-1.5">🩻 R/RAD :</span>
                                            <div className="flex-1 font-bold underline">{renderGroupedItemsForPrint(displayRads, displayItemAuthors)}</div>
                                        </div>
                                    )}
                                    {displayTms.length > 0 && (
                                        <div className="flex items-start bg-emerald-50 border border-emerald-300 text-emerald-900 px-1.5 py-1 rounded w-full leading-tight mb-1" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                            <span className="font-bold whitespace-nowrap flex-shrink-0 uppercase text-[10px] mr-1.5">💉 R/TNDKN :</span>
                                            <div className="flex-1">{renderItemsWithAuthors(displayTms, displayItemAuthors, false, true, record)}</div>
                                        </div>
                                    )}
                                    {rxs.length > 0 && (
                                        <div className="flex items-start bg-purple-50 border border-purple-300 text-purple-900 px-1.5 py-1 rounded w-full leading-tight" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                            <span className="font-bold whitespace-nowrap flex-shrink-0 uppercase text-[10px] mr-1.5">💊 ON TERAPI :</span>
                                            <div className="flex-1">{renderItemsWithAuthors(rxs, itemAuthors, true, true, record)}</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    {safeCurrentPrescription && (
                        <div className="border-t-2 border-dashed border-rose-400 pt-2 mt-2">
                            <div className="font-bold underline mb-1 inline-block px-1 text-xs text-rose-900 bg-rose-100 border border-rose-300 rounded" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>💊 RESEP OBAT</div>
                            <div className="font-mono text-xs pl-1 leading-relaxed text-gray-900 space-y-0.5">
                                {safeCurrentPrescription.split('\n').map((line, lIdx) => {
                                    const trimmed = line.trim(); let abBadge = null;
                                    const cleanMedName = trimmed.replace(/^[-\*\s\u2022\d.]+\s*/, '').split(/\s+\d/)[0].trim().replace(/\s+(iv|im|sc|po|drip)$/i, '');
                                    if (ANTIBIOTICS_DB.some(ab => cleanMedName.toLowerCase().includes(ab)) || /\bH\d+\b/i.test(trimmed)) {
                                        const hCode = getAntibioticDay(trimmed, record.medicationLogs || {});
                                        if (hCode) abBadge = <span className="ml-2 text-[9px] font-black border border-black bg-gray-100 px-1 py-[px] rounded">🚨 {hCode}</span>;
                                    }
                                    return <div key={lIdx} className="flex items-center flex-wrap"><span>{line}</span>{abBadge}</div>;
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col">
                    <div className="mb-2">
                        <div className="font-bold underline mb-1 bg-gray-100 inline-block px-1 text-xs">O (OBJEKTIF)</div>
                        <div className="mb-2 font-mono text-sm border border-black p-1.5 rounded bg-white leading-snug">
                            <div className="grid grid-cols-2 gap-x-4">
                                <div>TD : ____</div><div>N  : ____</div><div>S  : ____</div><div>RR : ____</div><div>SpO2: ___</div><div>GCS : ___</div>
                            </div>
                        </div>
                        <div className="font-sans pl-1 mt-1"><FormattedObjective text={safeObjective} /></div>
                    </div>
                    {hasSubjective && (
                        <div className="border-t-2 border-dashed border-gray-400 pt-2 mt-1">
                            <div className="font-bold underline mb-1 bg-gray-100 inline-block px-1 text-xs">S (SUBJEKTIF)</div>
                            <div className="whitespace-pre-wrap font-sans mb-3 pl-1">{safeSubjective}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const PrintView = ({ record, closePrint, historyLogs = [] }) => {
    return (
        <div className="fixed inset-0 bg-white z-[80] p-0 overflow-y-auto">
            <div className="p-4 bg-gray-100 flex justify-between items-center no-print sticky top-0 border-b shadow-sm">
                <h1 className="font-bold text-gray-700">Preview Cetak (APOS)</h1>
                <div className="flex gap-2">
                    <button onClick={() => handlePrintWindow('printable-area', `Cetak APOS - ${record.name}`, 'A5')} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold shadow hover:bg-blue-700 transition">🖨️ Cetak A5</button>
                    <button onClick={() => handlePrintWindow('printable-area', `Cetak APOS - ${record.name}`, 'A4')} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold shadow hover:bg-indigo-700 transition">🖨️ Cetak A4</button>
                    <button onClick={closePrint} className="px-4 py-2 bg-red-500 text-white rounded text-sm font-bold hover:bg-red-600 transition">Tutup</button>
                </div>
            </div>
            <div id="printable-area" className="p-4 flex justify-center">
                <div className="w-full max-w-4xl"><PrintLayout record={record} historyLogs={historyLogs} /></div>
            </div>
        </div>
    );
};

export const BulkPrintView = ({ records, onClose }) => {
    const sortedToPrint = useMemo(() => {
        return [...records].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' }));
    }, [records]);

    return (
        <div className="fixed inset-0 bg-white z-[150] overflow-y-auto">
            <div className="p-4 bg-indigo-50 flex justify-between items-center no-print sticky top-0 z-50 border-b shadow-sm">
                <div>
                    <h1 className="font-bold text-indigo-900">Cetak Banyak ({sortedToPrint.length} Pasien)</h1>
                    <p className="text-[10px] text-gray-500 italic">*Urutan otomatis berdasarkan nomor kamar</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => handlePrintWindow('bulk-printable-area', 'Cetak Banyak - APOS', 'A5')} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold shadow hover:bg-blue-700 transition">🖨️ Cetak A5</button>
                    <button onClick={() => handlePrintWindow('bulk-printable-area', 'Cetak Banyak - APOS', 'A4')} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold shadow hover:bg-indigo-700 transition">🖨️ Cetak A4</button>
                    <button onClick={onClose} className="px-4 py-2 bg-gray-500 text-white rounded text-sm font-bold hover:bg-gray-600 transition">Tutup</button>
                </div>
            </div>
            <div id="bulk-printable-area" className="p-4 bg-gray-50">
                {sortedToPrint.map((rec, index) => (
                    <div key={rec.id} className="print-page bg-white shadow mb-8 mx-auto print-break">
                        <div className="no-print bg-gray-200 text-gray-500 text-[10px] p-1 text-center font-bold uppercase mb-2">Halaman {index + 1}: {rec.roomNumber} - {rec.name}</div>
                        <PrintLayout record={rec} />
                    </div>
                ))}
            </div>
        </div>
    );
};

// =====================================================================
// EKSPOR FUNGSI CETAK HTML (DARI APP.JSX)
// =====================================================================

export const handlePrintTTV = (wardName) => {
    const element = document.getElementById('ttv-table-area');
    if (!element) return alert("Tabel tidak ditemukan.");
    const content = element.innerHTML;

    const html = `
    <!DOCTYPE html>
    <html><head><title>Print TTV Berwarna</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @page { size: A4 portrait; margin: 8mm; }
        body { font-family: Arial, sans-serif; zoom: 0.85; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        table { width: 100%; border-collapse: collapse !important; font-size: 8.5pt; table-layout: fixed; border: 0.75pt solid black !important; }
        th, td { border: 0.5pt solid black !important; padding: 3px 4px !important; vertical-align: top; background-color: white !important; }
        th { font-weight: bold; text-transform: uppercase; text-align: center; font-size: 8pt; }
        td:nth-child(5) { color: black !important; font-weight: bold; text-align: center; }
        td:nth-child(1) { width: 130px; } td:nth-child(2) { width: 60px; text-align: center; font-family: monospace; } 
        td:nth-child(3) { width: 35px; text-align: center; } td:nth-child(4) { width: 100px; text-align: center; font-family: monospace; } 
        td:nth-child(5) { width: 60px; } td:nth-child(6), td:nth-child(7), td:nth-child(8), td:nth-child(9), td:nth-child(10) { width: 42px; text-align: center; } 
        td:nth-child(11) { width: 110px; } 
        .no-print { display: none !important; } input { display: none !important; } span.hidden { display: inline !important; }
        h3 { text-align: center; margin: 0 0 10px 0; font-size: 14pt; font-weight: bold; color: black; } 
        .date-print { text-align: center; font-size: 8pt; margin-bottom: 10px; color: #555; }
    </style></head><body>
    <h3>Lembar Observasi Tanda Vital & Rencana Harian</h3>
    <div class="date-print">Dicetak: ${new Date().toLocaleString('id-ID')}</div>
    ${content}
    </body></html>
`;
    cetakPWA(html, 'Print TTV');
};

export const handlePrintSOAP = (wardName) => {
    const element = document.getElementById('ttv-table-area');
    if (!element) return alert("Tabel tidak ditemukan.");
    const content = element.innerHTML;

    const html = `
    <!DOCTYPE html>
    <html><head><title>Print Laporan SOAP</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @page { size: A4 portrait; margin: 5mm; }
        body { font-family: Arial, sans-serif; zoom: 0.65; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        table { width: 100%; border-collapse: collapse !important; font-size: 7pt; table-layout: fixed; }
        th, td { border: 1px solid black !important; padding: 3px !important; vertical-align: top; line-height: 1.15; }
        th { background-color: #e5e7eb !important; text-align: center; font-size: 8pt !important; font-weight: bold !important; }
        th:nth-child(1), td:nth-child(1) { width: 18%; } th:nth-child(2), td:nth-child(2) { width: 15%; } 
        th:nth-child(3), td:nth-child(3) { width: 30%; } th:nth-child(4), td:nth-child(4) { width: 12%; } 
        th:nth-child(5), td:nth-child(5) { width: 25%; } th:nth-child(6), td:nth-child(6) { display: none !important; } 
        .no-print { display: none !important; } input { display: none !important; } span.hidden { display: inline !important; }
        td { white-space: pre-wrap; word-wrap: break-word; }
        h3 { text-align: center; margin: 5px 0 2px 0; font-size: 14pt; text-transform: uppercase; color: #1e3a8a; } 
        .date-print { text-align: center; font-size: 8pt; margin-bottom: 10px; color: #555; }
    </style></head><body>
    <h3>Laporan Operan SOAP - Ruang ${wardName}</h3>
    <div class="date-print">Dicetak: ${new Date().toLocaleString('id-ID')}</div>
    ${content}
    </body></html>
`;
    cetakPWA(html, 'Print SOAP');
};

export const handlePrintBukuCM = (wardName) => {
    const content = document.getElementById('buku-cm-print');
    if (!content) return alert("Konten tidak ditemukan.");

    const html = `
    <html><head><title>Cetak Buku Register (CM)</title>
    <style>
        @page { size: A4 portrait; margin: 5mm; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 10px; zoom: 0.9; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { border: 1px solid black; padding: 4px; font-size: 8.5pt; text-align: center; overflow: hidden; }
        th { background-color: #f3f4f6; font-weight: bold; text-transform: uppercase; font-size: 7.5pt; }
        .text-left { text-align: left !important; padding-left: 5px; }
        th:nth-child(1), td:nth-child(1) { width: 30px; } th:nth-child(2), td:nth-child(2) { width: 160px; }
        th:nth-child(3), td:nth-child(3) { width: 40px; } th:nth-child(4), td:nth-child(4) { width: 75px; }
        th:nth-child(5), td:nth-child(5) { width: 110px; } th:nth-child(6), td:nth-child(6) { width: 35px; }
        th:nth-child(7), td:nth-child(7) { width: 125px; } th:nth-child(8), td:nth-child(8) { width: 75px; }
        input { display: none !important; } span.print-text { display: inline !important; } .no-print { display: none !important; }
        h3 { text-align: center; margin-bottom: 10px; font-size: 14pt; color: #065f46; }
    </style></head><body>
    <h3>BUKU REGISTER RUANGAN (CM) - ${wardName}</h3>
    ${content.innerHTML}
    </body></html>
`;
    cetakPWA(html, 'Cetak Buku Register (CM)');
};