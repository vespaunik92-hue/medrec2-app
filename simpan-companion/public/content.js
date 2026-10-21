// ===== PANEL MENGAMBANG SIMPAN (purwarupa) =====
(function () {
  if (window.top !== window) return;
  if (document.getElementById('simpan-float-root')) return;

  const host = document.createElement('div');
  host.id = 'simpan-float-root';
  host.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      .fab{width:48px;height:48px;border-radius:50%;border:0;background:#4f46e5;color:#fff;font-size:20px;
           box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer}
      .panel{display:none;position:fixed;right:12px;bottom:70px;width:min(420px,96vw);height:min(80vh,720px);
             background:#fff;border:2px solid #4f46e5;border-radius:12px;overflow:hidden;
             box-shadow:0 8px 30px rgba(0,0,0,.35)}
      .panel.open{display:block}
      iframe{width:100%;height:100%;border:0}
    </style>
    <button class="fab" title="SIMPAN Companion">💊</button>
    <div class="panel"><iframe></iframe></div>`;

  const fab = shadow.querySelector('.fab');
  const panel = shadow.querySelector('.panel');
  const frame = shadow.querySelector('iframe');
  fab.addEventListener('click', () => {
    if (!frame.src) frame.src = chrome.runtime.getURL('index.html');
    panel.classList.toggle('open');
  });

  (document.body || document.documentElement).appendChild(host);
})();
// ===== AKHIR PANEL MENGAMBANG =====

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SCRAPE_ECALYPTUS") {
    try {
      const pageText = document.body ? (document.body.innerText || "") : "";
      let lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);

      // ====================================================================
      // 1. IDENTITAS PASIEN (KARTU PROFIL KIRI)
      // ====================================================================
      const rmMatch = pageText.match(/(?:No\.?\s*RM|RM)\s*[:\n\r\t]*(\d{6,10})/i);
      const rmNumber = rmMatch ? rmMatch[1].trim() : "";

      let admissionDate = "";
      const regMatch = pageText.match(/(?:Tgl\.?\s*Reg(?:istrasi)?|Tanggal\s*Registrasi)\s*[:\n\r\t]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4}(?:[,\s]+[0-9]{1,2}[:.][0-9]{1,2})?)/i);
      if (regMatch) {
        admissionDate = regMatch[1].trim();
      }

      let dpjpName = "";
      for (let i = 0; i < lines.length; i++) {
        if (/^DPJP$/i.test(lines[i])) {
          if (lines[i + 1] && /^(?:dr\.|drg\.|dokter)/i.test(lines[i + 1])) {
            dpjpName = lines[i + 1].trim();
            break;
          }
        }
      }
      if (!dpjpName) {
        const dpjpMatch = pageText.match(/(?:^|\n)\s*DPJP\s*[:\n\r\t]+(dr\.?[^\n\r]+)/i);
        if (dpjpMatch) dpjpName = dpjpMatch[1].trim();
      }

      let gender = "L";
      let patientName = "";
      for (let i = 0; i < lines.length; i++) {
        if (/^(?:Perempuan|Laki-laki|Wanita|Pria|♂|♀)/i.test(lines[i])) {
          gender = /Perempuan|Wanita|♀/i.test(lines[i]) ? "P" : "L";
          let nameParts = [];
          for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
            const l = lines[j];
            if (/consent/i.test(l)) { if (nameParts.length) break; else continue; }
            if (/^(?:Informed\s*Consent|Detail\s*Pasien|Pasien\s*lainnya|Sembunyikan|Halaman\s*Utama|Pasien)$/i.test(l)) continue;
            if (/[0-9]/.test(l)) break;
            nameParts.unshift(l);
            if (nameParts.join(' ').length >= 5) break;
          }
          patientName = nameParts.join(' ');
          break;
        }
      }
      patientName = patientName.replace(/General\s*Consent\s*&?/gi, '').replace(/Informed\s*Consent/gi, '').replace(/\b(?:Ny|Tn|An|By|Nn|Sdr|Sdri)\b\.?/gi, '').replace(/\s+/g, ' ').trim();

            // ====================================================================
      // 1b. PILIH ENTRI CPPT DARI DPJP (BUKAN DOKTER JAGA)
      // ====================================================================
      let cpptSource = "";
      let cpptSourceOld = false;
      let cpptEntries = [];
      {
        const norm = s => (s || '').toLowerCase().replace(/[^a-z]/g, '');
        const starts = [];
        lines.forEach((l, i) => { if (/^Tanggal\s*Input/i.test(l)) starts.push(i); });

        if (starts.length > 0) {
          const entries = starts.map((s, k) => {
            const chunk = lines.slice(s, k + 1 < starts.length ? starts[k + 1] : lines.length);
            const pel = chunk.findIndex(l => /^Pelaksana/i.test(l));
            let author = "";
            if (pel !== -1) {
              author = chunk.slice(pel + 1, pel + 6)
                .find(l => /\bdr\b|dr\.|Sp\./i.test(l)) || "";
            }
            const dIdx = chunk.findIndex(l => /^Dokter\s*DPJP$/i.test(l));
            const specialty = dIdx !== -1 ? (chunk[dIdx + 1] || "") : "";
            const dateLine = chunk[0] + ' ' + (chunk[1] || '');
            const hasSOAP = chunk.some(l => /^Subjektif$/i.test(l)) && chunk.some(l => /^Objektif$/i.test(l));
            return { chunk, author, specialty, dateLine, hasSOAP };
          }).filter(e => e.hasSOAP);

          cpptEntries = [];
          const seenA = new Set();
          entries.forEach(e => {
            const k = norm(e.author);
            if (k && !seenA.has(k)) {   // entri terbaru per penulis
              seenA.add(k);
              cpptEntries.push({ key: k, label: `${e.author} (${e.specialty || '?'})` });
            }
          });

          let pick = null;
          if (request.authorKey) {
            pick = entries.find(e => norm(e.author) === request.authorKey);
          }
          if (!pick && dpjpName) {
            pick = entries.find(e => e.author && norm(e.author) === norm(dpjpName));
          }
          if (!pick) pick = entries[0];

          if (pick) {
            // Sertakan hanya isi entri; potong di "Instruksi" bila ada
            let chunk = pick.chunk;
            const ins = chunk.findIndex(l => /^Instruksi$/i.test(l));
            if (ins !== -1) chunk = chunk.slice(0, ins);
            lines = chunk;
            cpptSource = `${pick.author || '?'} (${pick.specialty || '?'}) ${pick.dateLine}`.replace(/\s+/g, ' ').trim();
            const isDpjp = dpjpName && norm(pick.author) === norm(dpjpName);
            if (!isDpjp) cpptSourceOld = true; // bukan entri DPJP -> beri peringatan
          }
        }
      }
      
      // ====================================================================
      // 2. CEK APAKAH SEDANG DI TAB CPPT ATAU TAB LAIN
      // ====================================================================
      let idxSubjektif = -1;
      let idxObjektif = -1;
      let idxAssesmen = -1;
      let idxRencana = -1;

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (/^Subjektif$/i.test(l) && idxSubjektif === -1) idxSubjektif = i;
        else if (/^Objektif$/i.test(l) && idxObjektif === -1) idxObjektif = i;
        else if (/^(?:Assesmen|Asesmen)$/i.test(l) && idxAssesmen === -1) idxAssesmen = i;
        else if (/^(?:Rencana|Resep)$/i.test(l) && idxAssesmen !== -1 && idxRencana === -1) {
          idxRencana = i;
        }
      }

      const isCpptPage = (idxSubjektif !== -1 && idxObjektif !== -1 && idxAssesmen !== -1);

      // ====================================================================
      // 3. DETEKTIF TAB: PATOLOGI KLINIK (HANYA AKTIF JIKA BUKAN TAB CPPT)
      // ====================================================================
      let extractedLab = "";
      const isActualLabTab = !isCpptPage && (
        /Dokter\s*Verifikator\s*Hasil/i.test(pageText) ||
        (/Nilai\s*Rujukan/i.test(pageText) && /Rincian\s*Tindakan/i.test(pageText))
      );

      if (isActualLabTab) {
        const labItems = [];
        const seen = new Set();
        const labDateMatch = pageText.match(/(?:Patologi\s*Klinik)[\s\S]*?(\d{1,2}\/\d{1,2}\/\d{4},\s*\d{1,2}[:.]\d{1,2})/i);
        const labTime = labDateMatch ? labDateMatch[1].trim() : "";

        // Samakan nama tes dengan format Smart Paste agar warna normal/abnormal bekerja
        const normalizeLabName = (name) => {
          const n = name.toLowerCase().replace(/\s+/g, ' ').trim();
          if (/a1c|glikohemoglobin/.test(n)) return 'HbA1c';
          if (/2\s*jam\s*pp|2\s*jpp|post\s*prandial/.test(n)) return '2JPP';
          if (/gula darah puasa|\bgdp\b/.test(n)) return 'GDP';
          if (/gula darah sewaktu|\bgds\b/.test(n)) return 'GDS';
          if (/^hemoglobin\b|^hb\b/.test(n)) return 'Hb';
          if (/hematokrit|^hct\b|^ht\b/.test(n)) return 'Ht';
          if (/^natrium|^na\b/.test(n)) return 'Na';
          if (/^kalium|^k\b/.test(n)) return 'K';
          if (/^klorida|^clorida|^chloride|^cl\b/.test(n)) return 'Cl';
          if (/^kalsium|^calcium|^ca\b/.test(n)) return 'Ca';
          return name;
        };
        
        const tableRows = document.querySelectorAll('tr');
        tableRows.forEach(tr => {
          const cells = Array.from(tr.querySelectorAll('td, th')).map(c => (c.innerText || '').trim());
          if (cells.length >= 2) {
            let tName = cells[0].split('\n')[0].trim();
            let tVal = cells[1].trim();

            if (!tName || /^(?:Rincian|Tindakan|Hasil|Satuan|Nilai|Status|Riwayat|-)$/i.test(tName)) return;
            if (!tVal || tVal === '-' || /^(?:Hasil|Satuan)$/i.test(tVal)) return;

            if (/\d/.test(tVal) || /^(?:Positif|Negatif|Reaktif|Non[- ]?Reaktif)$/i.test(tVal)) {
              tName = normalizeLabName(tName);
              const key = tName.toLowerCase();
              if (!seen.has(key)) {
                seen.add(key);
                labItems.push(`${tName} ${tVal}`);
              }
            }
          }
        });

        if (labItems.length > 0) {
          extractedLab = `Lab${labTime ? ` (${labTime})` : ''}:\n` + labItems.join('\n');
        }
      }

      // ====================================================================
      // 4. DETEKTIF TAB: RADIOLOGI (HANYA AKTIF JIKA BUKAN TAB CPPT)
      // ====================================================================
      let extractedRad = "";
      const isActualRadTab = !isCpptPage && (
        /Hasil\s*Pemeriksaan/i.test(pageText) && (/PACS/i.test(pageText) || /Sp\.Rad/i.test(pageText))
      );

      if (isActualRadTab) {
        const dateMatch = pageText.match(/(?:Hasil\s*USG|Radiologi)[\s\S]*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
        let kesanLines = [];
        let startCapture = false;

        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          if (/^KESAN\s*[:\n\r\t]*/i.test(l)) {
            startCapture = true;
            const inlineText = l.replace(/^KESAN\s*[:\n\r\t]*/i, '').trim();
            if (inlineText) kesanLines.push(inlineText);
            continue;
          }

          if (startCapture) {
            if (/^(?:Terima\s*kasih|Kesimpulan|PACS|Dokter|Status|Verifikasi|Sp\.Rad)/i.test(l)) {
              break;
            }
            kesanLines.push(l);
          }
        }

        if (kesanLines.length > 0) {
          const cleanKesan = kesanLines
            .map(line => line.replace(/^[-•*]\s*/, ''))
            .filter(Boolean)
            .map(line => `- ${line}`)
            .join('\n');
          extractedRad = `Rad${dateMatch ? ` (${dateMatch[1]})` : ''}:\nKesan:\n${cleanKesan}`;
        }
      }

      // ====================================================================
      // 5. DETEKTIF TAB: CPPT (SUBJEKTIF, OBJEKTIF, ASSESMEN, RENCANA & RESEP)
      // ====================================================================
      let subjective = "", objective = "", analysis = "", planning = "";
      let prescriptionList = [];

      if (isCpptPage) {
        // S (Subjektif)
        const sLines = lines.slice(idxSubjektif + 1, idxObjektif);
        subjective = sLines.filter(l => !/^(?:Hasil\s*USG|Kesan|Catatan)/i.test(l)).join('\n').trim();

        // O (Objektif)
        const oLines = lines.slice(idxObjektif + 1, idxAssesmen)
          .filter(l => !/^(?:Tanda\s*Vital|Angka|Catatan|-)$/i.test(l));
        objective = oLines.join('\n').trim();

        // A (Assesmen)
        const endAIdx = idxRencana !== -1 ? idxRencana : Math.min(lines.length, idxAssesmen + 5);
        const aLines = lines.slice(idxAssesmen + 1, endAIdx)
          .filter(l => !/^(?:Catatan|Simpan\s*SOAP|Planning|Resep|Rencana)$/i.test(l));
        analysis = aLines.join('\n').trim();

        // P (Planning) & Resep Obat: Ambil hanya kartu dokter teratas (Stop boundary ketat)
        if (idxRencana !== -1) {
          const pRawLines = [];
          for (let i = idxRencana + 1; i < lines.length; i++) {
            const l = lines[i];
            // BATAS BERHENTI KARTU TERATAS:
            if (/^(?:Instruksi|Tindakan|ICD9CM|Informasi|Pelaksana|Visite|Tanggal\s*Input|Tanggal\s*SOAP|Riwayat|Evaluasi|Konsul|Rujuk|Subjektif|Objektif|Assesmen|Asesmen|Filter|Simpan\s*SOAP)/i.test(l)) {
              break;
            }
            pRawLines.push(l);
          }

          // Pisahkan tabel e-resep
          const tableIndices = new Set();
          for (let i = 0; i < pRawLines.length; i++) {
            const l = pRawLines[i];
            const ddMatch = l.match(/(\d+)\s*dd\s*(\d+(?:[.,]\d+)?)/i);
            if (ddMatch && i > 0) {
              let medNameIdx = i - 1;
              while (medNameIdx >= 0 && (/^[-–—•*_\s]+$/.test(pRawLines[medNameIdx]) || /^(?:Catatan|Aturan|Nama)/i.test(pRawLines[medNameIdx]))) {
                medNameIdx--;
              }
              if (medNameIdx >= 0) {
                const rawMed = pRawLines[medNameIdx].replace(/^[-–—•*_\s]+/, '').trim();
                if (rawMed.length > 2 && !/^(?:Resep|No\.?\s*Resep|Nama|Aturan|Catatan)/i.test(rawMed)) {
                  prescriptionList.push(`- ${rawMed} (${ddMatch[1]}x${ddMatch[2]})`);
                  tableIndices.add(medNameIdx);
                  tableIndices.add(i);
                  if (i + 1 < pRawLines.length && /^[-–—•*_\s]+$/.test(pRawLines[i + 1])) tableIndices.add(i + 1);
                  if (i + 2 < pRawLines.length && /^[-–—•*_\s]+$/.test(pRawLines[i + 2])) tableIndices.add(i + 2);
                }
              }
            }
          }

          // Ambil sisa teks bebas dokter (kolom abu-abu) ke Planning
          const freePlanningLines = [];
          for (let i = 0; i < pRawLines.length; i++) {
            if (tableIndices.has(i)) continue;
            const l = pRawLines[i].trim();
            if (!l || /^[-–—•*_]+$/.test(l)) continue;
            if (/^(?:Resep|No\.?\s*Resep.*|Nama\s*Resep.*|Nama\s*Obat|Aturan\s*pakai.*|Catatan)$/i.test(l)) continue;
            if (/\d+\s*dd\s*[\d\.,]+/i.test(l)) continue;
            freePlanningLines.push(l);
          }

          planning = freePlanningLines.join('\n').trim();
        }
      }

      sendResponse({
        success: true,
        data: {
          name: patientName,
          rmNumber: rmNumber,
          gender: gender,
          admissionDate: admissionDate,
          dpjpName: dpjpName,
          isLab: Boolean(extractedLab),
          isRad: Boolean(extractedRad),
          labText: extractedLab,
          radText: extractedRad,
          subjective: subjective,
          objective: objective,
          analysis: analysis,
          planning: planning,
          prescription: prescriptionList.join('\n'),
          cpptSource, cpptSourceOld, cpptEntries
        }
      });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }
  return true;
});