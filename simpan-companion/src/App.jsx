import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore,
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc,
  getDocs,
  getDoc,
  onSnapshot, 
  Timestamp,
  deleteField // 👈 Tambahkan ini
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth'; // 👈 Tambahkan baris ini
import { PlanningQuickTag, buildWhatsAppText, cleanPrescriptionText, mergePlanningText, mergeDiagnosisText, mergePrescriptionText } from './utils/helpers';
import BukuCMTable from './components/BukuCMTable';
import { handlePrintBukuCM } from './components/PrintManager';
import { MedicationMarModal } from './components/MedicationBoard';
import { MEDICATION_TRANSLATOR } from './constants';

// ⚙️ Konfigurasi Firebase SIMPAN (Membaca dari .env lokal)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let db;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true
  });
} catch (e) {
  db = getFirestore(app);
}

// 🕒 FORMAT TANGGAL UNTUK BUKU CM (KEBAL TUKAR BULAN & HARI)
const formatDateCM = (isoString) => {
  if (!isoString) return '';

  if (typeof isoString === 'string') {
    const s = isoString.trim();

    // 0. Format ISO tanpa zona waktu (YYYY-MM-DDTHH:mm) -> ambil angkanya apa adanya
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2}))?(?::\d{2}(?:\.\d+)?)?$/);
    if (iso) {
      const [, y, m, d, h, mi] = iso;
      return `${d}/${m}/${y}, ${(h || '00').padStart(2, '0')}:${mi || '00'}`;
    }

    // 1. Teks DD/MM/YYYY atau DD-MM-YYYY dari Ecal
    //    (?<!\d) = harus mulai di awal angka, supaya tidak salah ambil potongan dari tahun
    const match = s.match(/(?<!\d)(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:[\s,]+(\d{1,2})[\:\.](\d{1,2}))?/);
    if (match) {
      let [_, d, m, y, h, min] = match;
      if (y.length === 2) y = '20' + y;
      const dd = d.padStart(2, '0');
      const mm = m.padStart(2, '0');
      const hh = (h || '00').padStart(2, '0');
      const mn = (min || '00').padStart(2, '0');
      return `${dd}/${mm}/${y}, ${hh}:${mn}`;
    }
  }

  // 2. Fallback untuk ISO String resmi Firestore / Timestamp (ada zona waktu, misal ...Z)
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return String(isoString);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}`;
};

const parseDateCM = (text) => {
  if (!text) return '';
  const match = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})[\s,]+(\d{1,2})[\:\.](\d{1,2})/);
  if (match) {
    let [_, d, m, y, h, min] = match;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min.padStart(2, '0')}`;
  }
  return text;
};

// ⏱️ HITUNG LAMA RAWAT BUKU CM (SISI KANAN ATAS PRINT)
const getDurationText = (admissionDateStr) => {
  if (!admissionDateStr) return '';
  const parsed = parseDateCM(admissionDateStr);
  const start = new Date(parsed || admissionDateStr);
  if (isNaN(start.getTime())) return '';
  const now = new Date();
  const diffTime = now.getTime() - start.getTime();
  if (diffTime < 0) return '';
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  const d1 = String(start.getDate()).padStart(2, '0');
  const m1 = String(start.getMonth() + 1).padStart(2, '0');
  const d2 = String(now.getDate()).padStart(2, '0');
  const m2 = String(now.getMonth() + 1).padStart(2, '0');
  const y2 = String(now.getFullYear()).slice(-2);

  return `${d1}/${m1} - ${d2}/${m2}/${y2} = ${diffDays} hr ${diffHours} jm`;
};

// ✨ TRANSFORMASI TANGGAL RELATIF (Hari Ini / Besok / Nama Hari)
const autoSmartDateTransformer = (text = '') => {
  if (!text) return '';
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  return text.replace(/\[([^\]]*?)(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})([^\]]*?)\]/g, (match, prefix, dayStr, monthStr, yearStr) => {
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    let year = parseInt(yearStr, 10);
    if (year < 100) year += 2000;

    const targetDate = new Date(year, month, day);
    const today = new Date();
    const tDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const oDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const diffDays = Math.round((tDate.getTime() - oDate.getTime()) / (1000 * 60 * 60 * 24));
    const targetDayName = dayNames[targetDate.getDay()];

    let relativeLabel = '';
    if (diffDays === 0) relativeLabel = 'Hari Ini';
    else if (diffDays === 1) relativeLabel = 'Besok';
    else if (diffDays > 1) relativeLabel = targetDayName;
    else relativeLabel = `Terlewat (${targetDayName})`;

    let timeModifier = '';
    const cleanP = (prefix || '').toLowerCase();
    if (cleanP.includes('pagi')) timeModifier = ' Pagi';
    else if (cleanP.includes('siang')) timeModifier = ' Siang';
    else if (cleanP.includes('sore')) timeModifier = ' Sore';
    else if (cleanP.includes('malam')) timeModifier = ' Malam';

    return `[${relativeLabel}${timeModifier}, ${dayStr}/${monthStr}/${yearStr.slice(-2)}]`;
  });
};

// 🧠 ENGINE PENGELOMPOK ITEM CETAK LAB & RAD (BEDA HARI = BEDA BARIS)
const groupItemsByDateForPrint = (rawItems) => {
  const groups = {};
  rawItems.forEach(raw => {
    const transformed = autoSmartDateTransformer(raw);
    const match = transformed.match(/\[([^\]]+)\]/);
    const dateTag = match ? match[0] : '';
    const cleanName = match ? transformed.replace(match[0], '').trim() : transformed.trim();
    const polished = cleanName.replace(/^[,;•\-\s]+|[,;•\-\s]+$/g, '').trim();

    if (!polished) return;

    if (!groups[dateTag]) groups[dateTag] = [];
    groups[dateTag].push(polished);
  });

  return Object.entries(groups).map(([dateTag, entries]) => {
    return `• ${entries.join(', ')} ${dateTag}`.trim();
  });
};

// DAFTAR KONFIGURASI KAMAR DARI CONSTANTS.JS
const WARD_CONFIG = {
  'MELATI': ['K1KM', 'K1P', 'K2KM', 'K2P', 'K3KM', 'K3P', 'K4KM', 'K4P', 'K5KM', 'K5P', 'K6KM', 'K6P', 'K7', 'K8', 'K9', 'K10KM', 'K10P', 'K11', 'K12', 'K13KM', 'K13P', 'K14', 'K15KM', 'K15P'],
  'DAHLIA': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  'TERATAI': ['K1A', 'K1B', 'K2A', 'K2B', 'K2C', 'K2D', 'K3A', 'K3B', 'K3C', 'K3D', 'K4A', 'K4B', 'K5A', 'K5B', 'K5C', 'K5D', 'K6A', 'K6B', 'K6C', 'K6D', 'K7A', 'K7B'],
  'ANYELIR': ['K1A', 'K1B', 'K1C', 'K1D', 'K2A', 'K2B', 'K2C', 'K2D', 'K3A', 'K3B', 'K3C', 'K3D', 'K4A', 'K4B', 'K4C', 'K4D', 'K5A', 'K5B', 'K5C', 'K5D', 'K6A', 'K6B', 'K6C', 'K6D', 'ISO-A', 'ISO-B'],
  'ANGGREK': ['K1A', 'K1B', 'K2A', 'K2B', 'K3A', 'K3B', 'K4A', 'K4B', 'K5A', 'K5B', 'K6A', 'K6B', 'K7A', 'K7B', 'K8A', 'K8B', 'K9A', 'K9B', 'K10A', 'K10B', 'ISO-A', 'ISO-B']
};

const WARDS = Object.keys(WARD_CONFIG);

const cleanBedKey = (val) => (val || '').replace(/[\s•·\-_]/g, '').toUpperCase();

// 🧹 AMBIL KODE KAMAR MURNI (Membersihkan kata "Bed", "(Kosong)", dan sisa nama pasien)
const getPureBedCode = (rawVal, bedList = []) => {
  if (!rawVal) return '';
  // 1. Ambil teks sebelum strip pemisah nama pasien
  let clean = rawVal.split(' - ')[0];
  // 2. Buang kata (Kosong) atau (KOSONG) beserta kurungnya
  clean = clean.replace(/\s*\([^\)]*\)/gi, '');
  // 3. Buang kata 'Bed' di depan jika ada
  clean = clean.replace(/^bed\s+/i, '').trim();

  // 4. Cocokkan dengan daftar resmi kamar bangsal
  const matched = bedList.find(b => cleanBedKey(b) === cleanBedKey(clean));
  return matched || clean;
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('simpan_companion_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [cpptAuthors, setCpptAuthors] = useState([]);
  const [pickedAuthor, setPickedAuthor] = useState('');

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [selectedWard, setSelectedWard] = useState('MELATI');
  const [selectedBed, setSelectedBed] = useState('K1KM');
  const [wardPatients, setWardPatients] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [showRaber, setShowRaber] = useState(false);
  const [showLaporModal, setShowLaporModal] = useState(false);
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [dpjpProfiles, setDpjpProfiles] = useState([]);

  const [loadingScrape, setLoadingScrape] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);

  // State untuk CPO
  const [isMarModalOpen, setIsMarModalOpen] = useState(false);
  const [marSelectedRecord, setMarSelectedRecord] = useState(null);
  const cpoWindowRef = useRef(null);
  const [cpoContainer, setCpoContainer] = useState(null);

  // State Cetak EOA (Metode Anti-Blank HTML Murni)
  const [showPrintConfig, setShowPrintConfig] = useState(false);
  const [includeCpoInPrint, setIncludeCpoInPrint] = useState(false);
  const [activePrintSize, setActivePrintSize] = useState('A5');

  const [formData, setFormData] = useState({
    name: '',
    rmNumber: '',
    gender: 'L',
    bpjsClass: '',
    admissionDate: '',
    dpjpName: '',
    raberName: '',
    raber2Name: '',
    raber3Name: '',
    analysis: '',
    planning: '',
    currentPrescription: '',
    objective: '',
    subjective: ''
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, `artifacts/${firebaseConfig.appId}/public/data/settings`, 'mainConfig');
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().dpjpProfiles) {
          setDpjpProfiles(snap.data().dpjpProfiles);
        }
      } catch (e) {
        console.warn("Gagal load dpjpProfiles:", e);
      }
    };
    fetchSettings();
  }, []);

  // 1. LOGIN
  const handleLogin = async (e) => {
    e.preventDefault();
    
    const rawUser = usernameInput.trim().toLowerCase();
    const cleanUser = rawUser.replace(/\s+/g, '_');
    const cleanPass = passwordInput.trim();

    if (!cleanUser || !cleanPass) {
      alert("Masukkan Username dan Password!");
      return;
    }

    setLoginLoading(true);
    try {
      const dummyEmail = `${cleanUser}@simpan.local`;
      const firebaseSafePass = cleanPass.length >= 6 ? cleanPass : cleanPass + "_simpan";
      const auth = getAuth();
      
      let isAuthSuccess = false;
      let finalUserId = cleanUser;

      try {
          // 1. Coba buka brankas Firebase Auth
          await signInWithEmailAndPassword(auth, dummyEmail, firebaseSafePass);
          isAuthSuccess = true;
      } catch (authError) {
          // 2. Fallback migrasi jika perawat pertama kali login lewat Companion
          let directDocSnap = await getDoc(doc(db, 'users', cleanUser));
          
          if (!directDocSnap.exists() && rawUser !== cleanUser) {
              directDocSnap = await getDoc(doc(db, 'users', rawUser));
              if (directDocSnap.exists()) finalUserId = rawUser;
          }

          if (directDocSnap.exists() && directDocSnap.data().pass === cleanPass) {
              try {
                  await createUserWithEmailAndPassword(auth, dummyEmail, firebaseSafePass);
                  isAuthSuccess = true;
                  
                  // Hapus jejak password lama
                  await updateDoc(doc(db, 'users', finalUserId), {
                      pass: deleteField()
                  });
              } catch (e) {
                  console.error(e);
              }
          }
      }

      if (!isAuthSuccess) {
          alert("Username atau password salah!");
          setLoginLoading(false);
          return;
      }

      const finalUserSnap = await getDoc(doc(db, 'users', finalUserId));
      if (!finalUserSnap.exists()) {
          alert("Data profil tidak ditemukan!");
          setLoginLoading(false);
          return;
      }

      const userData = finalUserSnap.data();
      if (userData.status === 'pending') {
          await auth.signOut();
          alert("Akun Anda berstatus PENDING. Hubungi Karu/Admin.");
          setLoginLoading(false);
          return;
      }

      const isDoctor = ['DPJP', 'Dokter_Jaga'].includes(userData.role);
      const foundUser = {
          ...userData,
          id: finalUserId,
          ward: isDoctor ? 'ALL' : (userData.ward || 'MELATI'),
          hospital: userData.hospital || 'RSUD Bayu Asih'
      };

      setCurrentUser(foundUser);
      localStorage.setItem('simpan_companion_user', JSON.stringify(foundUser));
    } catch (err) {
      alert("Gagal koneksi login: " + err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Keluar dari akun SIMPAN Companion?")) {
      try {
        const auth = getAuth();
        await signOut(auth); // 👈 Putus sesi Firebase
      } catch (err) {
        console.warn("Logout error:", err);
      }
      localStorage.removeItem('simpan_companion_user');
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    if (currentUser) {
      const userWard = (currentUser.ward || 'MELATI').toUpperCase();
      const finalWard = WARDS.includes(userWard) ? userWard : 'MELATI';
      setSelectedWard(finalWard);
      setSelectedBed(WARD_CONFIG[finalWard][0]);
    }
  }, [currentUser]);

  const isWardLocked = useMemo(() => {
    if (!currentUser) return true;
    return !['admin', 'DPJP', 'Dokter_Jaga'].includes(currentUser.role);
  }, [currentUser]);

  const currentBedList = WARD_CONFIG[selectedWard] || WARD_CONFIG['MELATI'];

  const handleWardChange = (e) => {
    const newWard = e.target.value;
    setSelectedWard(newWard);
    setSelectedBed(WARD_CONFIG[newWard][0]);
  };

  // 2. SINKRONISASI PASIEN BANGSAL
  useEffect(() => {
    if (!currentUser) return;

    const collPath = `artifacts/${firebaseConfig.appId}/public/data/medicalRecords`;
    const qColl = collection(db, collPath);

    const unsub = onSnapshot(qColl, (snapshot) => {
      const docs = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => (!p.ward || p.ward.toUpperCase() === selectedWard.toUpperCase()) && !p.isDischarged && p.status !== 'discharged');
      
      setWardPatients(docs);
    }, (err) => console.error("Firestore Error:", err));

    return () => unsub();
  }, [currentUser, selectedWard]);

  // 3. RESPON GANTI KASUR
  useEffect(() => {
    if (!currentUser) return;

    const existing = wardPatients.find(p => {
      const pBed = cleanBedKey(p.roomNumber || p.room || p.bed);
      return pBed === cleanBedKey(selectedBed);
    });

    if (existing) {
      setActiveDocId(existing.id);
      setFormData({
        name: existing.name || existing.nama || '',
        rmNumber: existing.rmNumber || existing.rm || '',
        gender: existing.gender || 'L',
        bpjsClass: existing.bpjsClass || '3',
        admissionDate: formatDateCM(existing.admissionDate || existing.regDate || ''),
        dpjpName: existing.dpjpName || existing.dpjp || '',
        raberName: existing.raberName || '',
        raber2Name: existing.raber2Name || '',
        raber3Name: existing.raber3Name || '',
        analysis: existing.analysis || '',
        planning: existing.planning || '',
        currentPrescription: existing.currentPrescription || '',
        objective: existing.objective || '',
        subjective: existing.subjective || ''
      });
      if (existing.raberName || existing.raber2Name || existing.raber3Name) {
        setShowRaber(true);
      }
    } else {
      setActiveDocId(null);
      setFormData({
        name: '',
        rmNumber: '',
        gender: 'L',
        bpjsClass: '3',
        admissionDate: '',
        dpjpName: '',
        raberName: '',
        raber2Name: '',
        raber3Name: '',
        analysis: '',
        planning: '',
        currentPrescription: '',
        objective: '',
        subjective: ''
      });
      setShowRaber(false);
    }
  }, [selectedBed, wardPatients, currentUser]);

  // 4. SMART APPEND TEXT
  const handleSmartAppendPlan = (prefix, placeholder = '') => {
    const inputItem = prompt(`Masukkan nama untuk ${prefix}:`, placeholder);
    if (inputItem === null) return;
    const cleanItem = inputItem.trim();

    const today = new Date();
    const dStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getFullYear()).slice(-2)}`;
    const timeTag = `[${dStr}]`;

    setFormData(prev => {
      const current = prev.planning || '';
      const newItem = cleanItem ? `${prefix} ${cleanItem} ${timeTag}` : `${prefix} ${timeTag}`;

      if (!current.trim()) {
        return { ...prev, planning: newItem };
      }

      if (prefix.startsWith('Th.') || prefix.startsWith('TM.')) {
        return { ...prev, planning: `${newItem}\n${current.trim()}` };
      }

      const lines = current.split('\n');
      let merged = false;
      const updatedLines = lines.map(line => {
        if (!merged && line.startsWith(prefix) && line.includes(timeTag)) {
          merged = true;
          return line.replace(timeTag, `, ${cleanItem || '...'} ${timeTag}`).replace(/\s+,/g, ',');
        }
        return line;
      });

      if (merged) {
        return { ...prev, planning: updatedLines.join('\n') };
      }

      return { ...prev, planning: `${newItem}\n${current.trim()}` };
    });
  };

  const handleAppendLacak = () => {
    const inputLacak = prompt('Masukkan pemeriksaan yang ingin dilacak/dilapor:', 'Urin');
    if (inputLacak === null) return;
    const cleanLacak = inputLacak.trim() || 'Hasil Lab';

    setFormData(prev => {
      const cur = prev.objective || '';
      const tag = `⚠️ Lacak/Lapor: ${cleanLacak}`;
      if (cur.includes(tag)) return prev;
      return { ...prev, objective: cur.trim() ? `${tag}\n${cur.trim()}` : tag };
    });
  };
  
  // 5. PENYEDOT DATA ECALYPTUS (DILENGKAPI PENYARING CERDAS RESEP OBAT)
  const handleScrapeEcal = async () => {
    setLoadingScrape(true);
    try {
      if (typeof chrome === 'undefined' || !chrome.tabs) {
        alert("Buka ekstensi ini di bilah samping browser Chrome.");
        return;
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        alert("Buka tab Ecalyptus terlebih dahulu.");
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: "SCRAPE_ECALYPTUS", authorKey: pickedAuthor }, (response) => {
        if (chrome.runtime.lastError) {
          alert("Gagal membaca tab Ecalyptus!\n\n1. Klik tab Ecalyptus di sebelah kiri.\n2. Tekan F5 untuk refresh.\n3. Klik tombol Ambil Data ini kembali.");
          return;
        }

        if (response?.success && response.data) {
          const d = response.data;
          setCpptAuthors(response.data.cpptEntries || []);

          const matchedDpjp = (() => {
            if (!d.dpjpName) return null;
            const clean = (s) => (s || '').toLowerCase()
              .replace(/^(dr\.|drg\.|dokter)\s*/i, '')
              .replace(/,\s*(sp\.[a-z]+|sp[a-z]+|m\.kes|mkes|ph\.d|phd).*$/i, '')
              .replace(/[^a-z0-9]/gi, '')
              .trim();
            const targetClean = clean(d.dpjpName);
            const found = dpjpProfiles.find(opt => {
              const optClean = clean(opt.name);
              return (targetClean && optClean) && (targetClean.includes(optClean) || optClean.includes(targetClean));
            });
            return found ? found.name : d.dpjpName;
          })();

          setFormData(prev => {
            let mergedObjective = prev.objective || '';

            if (d.labText && !mergedObjective.includes(d.labText.trim())) {
              mergedObjective = mergedObjective.trim() 
                ? `${d.labText.trim()}\n\n${mergedObjective.trim()}` 
                : d.labText.trim();
            }

            if (d.radText && !mergedObjective.includes(d.radText.trim())) {
              mergedObjective = mergedObjective.trim() 
                ? `${mergedObjective.trim()}\n\n${d.radText.trim()}` 
                : d.radText.trim();
            }

            if (d.objective && !mergedObjective.includes(d.objective.trim())) {
              mergedObjective = mergedObjective.trim() 
                ? `${mergedObjective.trim()}\n\n${d.objective.trim()}` 
                : d.objective.trim();
            }

            // 🧹 FILTER RESEP MENGGUNAKAN PENYARING CERDAS
            const rawRx = d.prescription || '';
            const cleanedRx = rawRx ? cleanPrescriptionText(rawRx, MEDICATION_TRANSLATOR).replace(/\s*,+\s*\)/g, ')').replace(/,+\s*$/gm, '') : '';
            if (localStorage.getItem('simpan_debug') === '1') console.log('RESEP MENTAH:', JSON.stringify(rawRx), '| BERSIH:', JSON.stringify(cleanedRx));

            return {
              ...prev,
              name: d.name ? d.name.toLowerCase().replace(/(?:^|\s|-)\S/g, c => c.toUpperCase()) : prev.name,
              rmNumber: d.rmNumber || prev.rmNumber,
              gender: d.gender || prev.gender,
              admissionDate: d.admissionDate ? formatDateCM(d.admissionDate) : prev.admissionDate,
              dpjpName: matchedDpjp || prev.dpjpName,
              subjective: d.subjective ? d.subjective : prev.subjective,
              objective: mergedObjective,
              analysis: d.analysis ? mergeDiagnosisText(prev.analysis, d.analysis) : prev.analysis,
              planning: d.planning ? d.planning : prev.planning,
              currentPrescription: cleanedRx
                ? mergePrescriptionText(prev.currentPrescription, cleanedRx)
                : prev.currentPrescription
            };
          });

          if (d.isLab) {
            alert("🧪 Berhasil menyalin hasil Patologi Klinik ke kolom O (Objektif)!");
          } else if (d.isRad) {
            alert("🩻 Berhasil menyalin hasil Radiologi ke kolom O (Objektif)!");
          } else {
            alert("✅ Berhasil menyalin Profil, Resep, & Planning CPPT!");
          }
        } else {
          alert("Data Ecalyptus belum termuat sempurna.");
        }
      });
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setLoadingScrape(false);
    }
  };

  // 🌟 PENYAMBUNG QUICK TAG KE KOLOM PLANNING
  const handleSelectQuickTag = (tagText) => {
    setFormData(prev => ({
      ...prev,
      planning: mergePlanningText(prev.planning || '', tagText)
    }));
  };
  
  const executePrintStatic = (paperSize) => {
    if (!formData.name) {
      alert("Pilih kasur atau isi nama pasien terlebih dahulu!");
      return;
    }

    const record = {
      ...formData,
      // PrintLayout memakai new Date(admissionDate), jadi harus format ISO, bukan "dd/mm/yyyy, hh:mm"
      admissionDate: parseDateCM(formData.admissionDate),
      roomNumber: selectedBed,
      ward: selectedWard,
      medicationLogs: wardPatients.find(p => p.id === activeDocId)?.medicationLogs || {},
      status: 'active'
    };

    try {
      localStorage.setItem('simpan_print_job', JSON.stringify({
        record,
        includeCpo: includeCpoInPrint,
        paperSize,
        createdAt: Date.now()
      }));
    } catch (e) {
      alert("Gagal menyiapkan data cetak: " + e.message);
      return;
    }

    const url = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
      ? chrome.runtime.getURL('print.html')
      : '/print.html';

    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }

    setShowPrintConfig(false);
  };

  // 📖 CETAK BUKU REGISTER RUANGAN (CM) DARI COMPANION (SYMLINK KE INDUK)
  const executePrintBukuCM = () => {
    const printContainer = document.getElementById('buku-cm-print');
    if (!printContainer) {
      alert("Komponen Buku CM belum siap.");
      return;
    }

    // Ambil nama ruangan (MELATI, DAHLIA, dll)
    const wardName = selectedWard || currentUser?.ward || 'MELATI';

    // 🌟 PANGGIL LANGSUNG FUNGSI DARI PRINTMANAGER INDUK!
    handlePrintBukuCM(wardName);
  };

  // 💊 TUTUP JENDELA CPO
  const handleCloseCPO = () => {
    setIsMarModalOpen(false);
    setMarSelectedRecord(null);
    setCpoContainer(null);
    if (cpoWindowRef.current && !cpoWindowRef.current.closed) {
      cpoWindowRef.current.close();
    }
  };

  // 💊 PEMICU BUKA CPO DI JENDELA LUAS (POPOUT 950x750)
  const handleOpenCPO = () => {
    if (!activeDocId) {
      alert("Pilih kasur atau ambil data pasien terlebih dahulu!");
      return;
    }

    const activePatient = wardPatients.find(p => p.id === activeDocId);
    if (!activePatient) return;

    const combinedData = {
      ...activePatient,
      planning: `${activePatient.planning || ''}\n${formData.currentPrescription || ''}`
    };
    setMarSelectedRecord(combinedData);

    // Jika jendela pop-up sudah ada, fokuskan saja
    if (cpoWindowRef.current && !cpoWindowRef.current.closed) {
      cpoWindowRef.current.focus();
      return;
    }

    // Buka jendela baru yang luas mandiri
    const win = window.open('', 'SIMPAN_CPO_POPUP', 'width=950,height=750,top=100,left=150');
    if (!win) {
      alert("Gagal membuka jendela CPO. Pastikan izin pop-up browser aktif.");
      return;
    }

    cpoWindowRef.current = win;

        // Salin stylesheet CSS agar tampilan CPO tetap berwarna & rapi
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(el => el.outerHTML)
      .join('\n');

    win.document.open();
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>CPO - ${formData.name}</title>
        ${styles}
        <style>
          body {
            margin: 0;
            padding: 10px;
            background: #f1f5f9;
            font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          }
        </style>
      </head>
      <body>
        <div id="cpo-popup-root"></div>
      </body>
      </html>
    `);
    win.document.close();

    const rootElem = win.document.getElementById('cpo-popup-root');
    setCpoContainer(rootElem);
    setIsMarModalOpen(true);

    // Otomatis sinkron jika jendela ditutup dari tombol silang (X) browser
    win.onbeforeunload = () => {
      setIsMarModalOpen(false);
      setMarSelectedRecord(null);
      setCpoContainer(null);
    };
  };

  // 7. DISCHARGE PASIEN (PULANG, PINDAH, MENINGGAL)
  const handleExecuteDischarge = async (dischargeType) => {
    if (!activeDocId) {
      alert("Pilih kasur yang sedang terisi pasien terlebih dahulu!");
      return;
    }

    if (!window.confirm(`Konfirmasi: Pulangkan ${formData.name} dari Bed ${selectedBed} dengan status [${dischargeType.toUpperCase()}]?`)) {
      return;
    }

    try {
      const docRef = doc(db, `artifacts/${firebaseConfig.appId}/public/data/medicalRecords`, activeDocId);
      await updateDoc(docRef, {
        isDischarged: true,
        dischargeType: dischargeType,
        dischargeDate: new Date().toISOString(),
        lastRoom: selectedBed,
        roomNumber: '',
        status: 'discharged',
        updatedAt: Timestamp.now()
      });

      alert(`✅ Pasien ${formData.name} telah dipulangkan (${dischargeType}). Bed ${selectedBed} sekarang KOSONG!`);
      setShowDischargeModal(false);

      setFormData({
        name: '', rmNumber: '', gender: 'L', bpjsClass: '3', admissionDate: '',
        dpjpName: '', raberName: '', raber2Name: '', raber3Name: '', analysis: '',
        planning: '', currentPrescription: '', objective: '', subjective: ''
      });
      setActiveDocId(null);
    } catch (e) {
      alert("Gagal memproses kepulangan: " + e.message);
    }
  };

  // 8. LAPOR WHATSAPP (SINKRON DENGAN INDUK VIA HELPERS)
const handleLaporWA = async (type, raberIndex = 0) => {
  const { text, targetNumber } = buildWhatsAppText({
    patient: { ...formData, roomNumber: selectedBed },
    senderName: currentUser?.name || 'Perawat',
    wardName: selectedWard,
    type,
    raberIndex,
    dpjpProfiles
  });

  if ((type === 'DPJP' || type === 'Raber') && !targetNumber) {
    alert('Nomor WhatsApp dokter tujuan belum disetel di Master Data.');
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {}

  const url = targetNumber
    ? `https://wa.me/${targetNumber}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;

  window.open(url, '_blank');
  setShowLaporModal(false);
};

  // 9. SIMPAN KE FIRESTORE
  const handleSaveToSimpan = async () => {
    if (!formData.name.trim()) {
      alert("Nama Pasien wajib diisi!");
      return;
    }

    setLoadingSave(true);
    try {
      const docId = activeDocId || `rec_${formData.rmNumber || Date.now()}`;
      const docRef = doc(db, `artifacts/${firebaseConfig.appId}/public/data/medicalRecords`, docId);

      const now = new Date();
      const dateStamp = `[${currentUser?.name?.split(' ')[0] || 'Perawat'}, ${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}]`;

      // 🌟 KUNCI PEMBERSIH: Pastikan kode kasur murni sebelum masuk ke Firestore
      const pureBed = getPureBedCode(selectedBed, currentBedList);

      const payload = {
        name: formData.name.trim(),
        nama: formData.name.trim(),
        rmNumber: formData.rmNumber.trim(),
        rm: formData.rmNumber.trim(),
        gender: formData.gender,
        bpjsClass: formData.bpjsClass,
        admissionDate: parseDateCM(formData.admissionDate),
        roomNumber: pureBed, // 👈 Pakai pureBed (Bukan selectedBed mentah)
        room: pureBed,       // 👈 Pakai pureBed
        bed: pureBed,        // 👈 Pakai pureBed
        ward: selectedWard,
        dpjpName: formData.dpjpName,
        dpjp: formData.dpjpName,
        raberName: formData.raberName || '',
        raber2Name: formData.raber2Name || '',
        raber3Name: formData.raber3Name || '',
        analysis: formData.analysis,
        planning: formData.planning,
        currentPrescription: formData.currentPrescription,
        objective: formData.objective,
        subjective: formData.subjective,
        status: 'active',
        isDischarged: false,
        lastNurse: currentUser?.name || 'Perawat',
        savedBy: currentUser?.name || 'Perawat',
        lastStamp: dateStamp,
        updatedAt: Timestamp.now()
      };

      if (!activeDocId) {
        payload.createdAt = Timestamp.now();
      }

      await setDoc(docRef, payload, { merge: true });
      alert(`✅ Data Bed ${selectedBed} (${formData.name}) tersinkronisasi ke web SIMPAN!`);
    } catch (err) {
      alert("Gagal simpan ke Firebase: " + err.message);
    } finally {
      setLoadingSave(false);
    }
  };

  // ⌨️ SHORTCUT KEYBOARD (aktif saat kursor/fokus ada di panel companion)
  const shortcutRef = useRef({});
  shortcutRef.current = {
    scrape: handleScrapeEcal,
    save: handleSaveToSimpan,
    print: () => setShowPrintConfig(true),
    loadingScrape,
    loadingSave,
    loggedIn: Boolean(currentUser),
  };

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (!['s', 'p', 'e'].includes(k)) return;

      e.preventDefault(); // cegah "Save page" / print bawaan Chrome
      const s = shortcutRef.current;
      if (!s.loggedIn || e.repeat) return;

      if (k === 's' && !s.loadingSave) s.save();
      else if (k === 'e' && !s.loadingScrape) s.scrape();
      else if (k === 'p') s.print();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  
  // ⏱️ AUTO LOGOUT JIKA LAMA TIDAK ADA AKTIVITAS DI PANEL
  const IDLE_LIMIT_MS = 60 * 60 * 1000; // 60 menit (ubah angka 60 sesuai selera)
  useEffect(() => {
    const KEY = 'simpan_companion_last_active';

    // Di layar login: bersihkan catatan lama agar login baru tidak langsung terlempar
    if (!currentUser) {
      try { localStorage.removeItem(KEY); } catch {}
      return;
    }

    const touch = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch {} };

    const forceLogout = () => {
      try {
        localStorage.removeItem('simpan_companion_user');
        localStorage.removeItem(KEY);
      } catch {}
      setCurrentUser(null);
    };

    const check = () => {
      let last = 0;
      try { last = parseInt(localStorage.getItem(KEY) || '0', 10); } catch {}
      if (last && Date.now() - last > IDLE_LIMIT_MS) forceLogout();
    };

    // Saat panel dibuka: kalau sudah terlalu lama sejak aktivitas terakhir, langsung keluar
    check();
    touch();

    let lastWrite = Date.now();
    const onActivity = () => {
      const now = Date.now();
      if (now - lastWrite > 5000) { lastWrite = now; touch(); } // hemat tulis storage
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'focus'];
    events.forEach(ev => window.addEventListener(ev, onActivity, true));
    const timer = setInterval(check, 30000); // cek tiap 30 detik

    return () => {
      events.forEach(ev => window.removeEventListener(ev, onActivity, true));
      clearInterval(timer);
    };
  }, [currentUser]);

  // ==========================================
  // TAMPILAN LOGIN IDENTIK WEB SIMPAN
  // ==========================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-3 select-none">
        <div className="w-full max-w-xs bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

          <div className="p-5 text-center space-y-3.5">
            <div className="flex flex-col items-center justify-center">
              <img 
                src="/logo1.png" 
                alt="Logo SIMPAN" 
                className="h-20 w-auto object-contain mb-1 drop-shadow-sm" 
              />
              <p className="text-[8.5px] text-slate-400 font-bold uppercase tracking-widest">
                Sistem Manajemen Operan Abi Nugroho
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3 text-left">
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Username</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-400 text-xs pointer-events-none">👤</span>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={e => setUsernameInput(e.target.value)}
                    placeholder="Ketik username..."
                    className="w-full pl-8 pr-2.5 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Password</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-400 text-xs pointer-events-none">🔒</span>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    placeholder="••••••"
                    className="w-full pl-8 pr-2.5 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium transition"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition disabled:bg-slate-400 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {loginLoading ? 'Memeriksa...' : '🚀 Masuk'}
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 text-center space-y-1">
              <a 
                href="https://trakteer.id/481nugroho" 
                target="_blank" 
                rel="noreferrer" 
                className="text-[10px] text-amber-600 font-bold hover:underline block"
              >
                ✨ Traktir Kopi?
              </a>
              <span className="text-[8.5px] text-slate-400 block">
                © 2026 SIMPAN - E-Ontang-Anting
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // TAMPILAN FORM COMPANION
  // ==========================================
  return (
    <div className="p-2.5 bg-slate-50 min-h-screen text-slate-800 flex flex-col gap-2 text-xs select-none relative">
      
      {/* 1. HEADER AKUN */}
      <div className="bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">👤</span>
          <div>
            <div className="font-bold text-[11px] text-slate-800 leading-tight truncate max-w-[150px]">
              {currentUser.name || currentUser.username}
            </div>
            <div className="text-[9px] text-emerald-600 font-bold leading-none flex items-center gap-1 mt-0.5">
              ● Ruang {currentUser.ward || 'MELATI'}
            </div>
          </div>
        </div>

        {/* KELOMPOK TOMBOL KANAN: BUKU CM & LOGOUT */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handlePrintBukuCM(selectedWard || currentUser?.ward || 'MELATI')}
            className="text-[9px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-lg font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
            title="Cetak Rekap Buku Catatan Medik (CM) Ruangan"
          >
            <span>📖</span> CM
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="text-[9px] bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 px-2 py-1 rounded-lg font-bold transition shadow-xs cursor-pointer"
          >
            🚪 Keluar
          </button>
        </div>
      </div>

      {/* 2. TOOLBAR ATAS: RUANG, EOA, LAPOR & PULANG */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1 flex-1">
            <span className="font-bold text-[9px] text-slate-500 uppercase">RUANG:</span>
            <select
              value={selectedWard}
              onChange={handleWardChange}
              disabled={isWardLocked}
              className={`w-full font-black text-xs outline-none rounded px-1.5 py-0.5 border ${
                isWardLocked 
                  ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed' 
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 cursor-pointer'
              }`}
            >
              {WARDS.map(w => <option key={w} value={w}>Ruang {w}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* CETAK EOA */}
            <button
              onClick={() => setShowPrintConfig(true)}
              className="bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 font-black px-2 py-1 rounded-lg shadow-xs transition flex items-center gap-0.5 cursor-pointer text-[11px]"
              title="Cetak lembar APOS resmi (E-Ontang-Anting)"
            >
              <span>🖨️</span> EOA
            </button>

            {/* LAPOR WA */}
            <button
              onClick={() => setShowLaporModal(true)}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-black px-2 py-1 rounded-lg shadow-xs transition flex items-center gap-0.5 cursor-pointer text-[11px]"
              title="Kirim laporan SOAP ke WhatsApp"
            >
              <span>📢</span> Lapor
            </button>

            {/* PULANGKAN PASIEN */}
            <button
              onClick={() => setShowDischargeModal(true)}
              disabled={!activeDocId}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-black px-2 py-1 rounded-lg shadow-xs transition flex items-center gap-0.5 cursor-pointer text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
              title="Pulangkan / Mutasi Pasien (Kosongkan Bed)"
            >
              <span>🚪</span>
            </button>
          </div>
        </div>

        {/* PEMILIH BED PASIEN (SEARCHABLE: BISA KETIK KAMAR ATAU NAMA PASIEN) */}
        <div className="flex items-center gap-1.5 flex-1">
          <span className="font-bold text-[9px] text-slate-500 uppercase shrink-0">KAMAR:</span>
          <div className="relative w-full">
            <input
              type="text"
              list="companion-kamar-list"
              value={(() => {
                const pure = getPureBedCode(selectedBed, currentBedList);
                if (!pure) return '';
                const occ = wardPatients.find(p => cleanBedKey(p.roomNumber || p.room || p.bed) === cleanBedKey(pure));
                const pName = (occ ? (occ.name || occ.nama) : formData.name)?.trim();
                const prefix = selectedWard === 'DAHLIA' ? 'BED ' : '';
                return pName ? `${prefix}${pure} - ${pName}` : `${prefix}${pure}`;
              })()}
              onChange={e => {
                const val = e.target.value;

                // 1. Jika dipilih dari dropdown dengan nama (format: "BED 10 - ABI ANTIK")
                if (val.includes(' - ')) {
                  const pure = getPureBedCode(val, currentBedList);
                  setSelectedBed(pure);
                  return;
                }

                // 2. Jika user memilih kamar kosong atau mengetik langsung
                const pure = getPureBedCode(val, currentBedList);
                setSelectedBed(pure);
              }}
              onBlur={e => {
                const val = (e.target.value || '').trim();
                if (!val) return;

                // Sensor Pencarian Nama Pasien
                const matchedPatient = wardPatients.find(p => {
                  const pName = (p.name || p.nama || '').toLowerCase();
                  return pName && pName.includes(val.toLowerCase());
                });

                if (matchedPatient) {
                  const targetBed = currentBedList.find(b => 
                    cleanBedKey(b) === cleanBedKey(matchedPatient.roomNumber || matchedPatient.room || matchedPatient.bed)
                  );
                  if (targetBed) {
                    setSelectedBed(targetBed);
                    return;
                  }
                }

                const pure = getPureBedCode(val, currentBedList);
                setSelectedBed(pure);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.target.blur();
                }
              }}
              onFocus={e => e.target.select()}
              placeholder="Ketik kamar / nama..."
              autoComplete="off"
              className="w-full font-black text-slate-800 bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 uppercase"
            />
            <datalist id="companion-kamar-list">
              {currentBedList.map(bed => {
                const occ = wardPatients.find(p => cleanBedKey(p.roomNumber || p.room || p.bed) === cleanBedKey(bed));
                const pName = occ ? (occ.name || occ.nama || '').trim() : '';
                const prefix = selectedWard === 'DAHLIA' ? 'Bed ' : '';
                
                // 🌟 KUNCI: JANGAN masukkan kata '(Kosong)' ke dalam value agar value input tetap bersih murni
                const datalistValue = pName 
                  ? `${prefix}${bed} - ${pName}`
                  : `${prefix}${bed}`;

                return (
                  <option key={bed} value={datalistValue}>
                    {occ ? `🔴 Pasien: ${pName}` : '🟢 Kamar Kosong'}
                  </option>
                );
              })}
            </datalist>
          </div>
        </div>
      </div>

      {/* 3. TOMBOL UTAMA BERDAMPINGAN: AMBIL DATA ECAL & SIMPAN PASIEN (50 : 50) */}
      <div className="grid grid-cols-2 gap-2 sticky top-0 z-30 bg-slate-50 py-1.5 -mx-2.5 px-2.5 border-b border-slate-200 shadow-sm">
        <button
          onClick={handleScrapeEcal}
          disabled={loadingScrape}
          className="py-2 px-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer text-xs"
        >
          <span>⚡</span> {loadingScrape ? "Menyalin..." : "Ambil Data Ecal"}
        </button>
        
        <button
          onClick={handleSaveToSimpan}
          disabled={loadingSave}
          className="py-2 px-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black rounded-xl shadow-sm transition disabled:bg-slate-400 flex items-center justify-center gap-1.5 cursor-pointer text-xs"
        >
          <span>💾</span> {loadingSave ? "Menyimpan..." : "Simpan Pasien"}
        </button>
      </div>
      
      {cpptAuthors.length > 1 && (
          <select
            value={pickedAuthor}
            onChange={e => setPickedAuthor(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white"
          >
            <option value="">Sumber CPPT: DPJP (otomatis)</option>
            {cpptAuthors.map(a => (
              <option key={a.key} value={a.key}>{a.label}</option>
            ))}
          </select>
        )}

      {/* 4. FORM IDENTITAS PASIEN */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm space-y-1.5">
        <div className="grid grid-cols-12 gap-1.5">
          <div className="col-span-2">
            <label className="text-[8px] font-bold text-slate-500 uppercase">GDR</label>
            <select value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })} className="w-full p-1 border rounded border-slate-300 text-xs font-bold bg-white">
              <option value="L">Lk</option>
              <option value="P">Pr</option>
            </select>
          </div>
          <div className="col-span-3">
            <label className="text-[8px] font-bold text-slate-500 uppercase">NO. RM</label>
            <input type="text" value={formData.rmNumber} onChange={e => setFormData({ ...formData, rmNumber: e.target.value })} placeholder="00xxxx" className="w-full p-1 border rounded border-slate-300 font-mono text-xs outline-none focus:border-indigo-400" />
          </div>
          <div className="col-span-2">
            <label className="text-[8px] font-bold text-slate-500 uppercase">KLS</label>
            <select value={formData.bpjsClass} onChange={e => setFormData({ ...formData, bpjsClass: e.target.value })} className="w-full p-1 border rounded border-slate-300 text-xs bg-white">
              <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="Umum">Umum</option>
            </select>
          </div>
          <div className="col-span-5">
            <label className="text-[8px] font-bold text-slate-500 uppercase">TGL MASUK</label>
            <input type="text" value={formData.admissionDate} onChange={e => setFormData({ ...formData, admissionDate: e.target.value })} placeholder="dd/mm/yyyy, hh:mm" className="w-full p-1 border rounded border-slate-300 font-mono text-[10px] outline-none focus:border-indigo-400" />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-1.5">
          <div className="col-span-6">
            <label className="text-[8px] font-bold text-slate-500 uppercase">NAMA PASIEN *</label>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Nama Lengkap" className="w-full p-1 border rounded border-slate-300 font-bold text-xs outline-none focus:border-indigo-400" />
          </div>
          {/* DPJP UTAMA (SEARCHABLE & DROPDOWN) */}
          <div className="col-span-6">
            <label className="text-[8px] font-bold text-slate-500 uppercase block mb-0.5">DPJP UTAMA *</label>
            <input
              type="text"
              list="companion-dpjp-list"
              value={formData.dpjpName || ''}
              onChange={e => setFormData({ ...formData, dpjpName: e.target.value })}
              onFocus={e => e.target.select()}
              placeholder="Ketik / pilih dokter..."
              autoComplete="off"
              className="w-full p-1 border rounded border-slate-300 text-[10px] bg-white font-semibold truncate outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <datalist id="companion-dpjp-list">
              {dpjpProfiles.map(p => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </datalist>
          </div>
        </div>

        {/* 🩺 PILIHAN 3 DOKTER RABER */}
        <div>
          {!showRaber ? (
            <button type="button" onClick={() => setShowRaber(true)} className="text-[9px] text-blue-600 font-bold hover:underline cursor-pointer">+ Tambah Raber</button>
          ) : (
            <div className="pt-1 border-t border-slate-100">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[8px] font-bold text-slate-400 uppercase">Dokter Rawat Bersama (Raber)</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowRaber(false);
                    setFormData(prev => ({ ...prev, raberName: '', raber2Name: '', raber3Name: '' }));
                  }}
                  className="text-[8px] text-red-500 hover:underline font-bold cursor-pointer"
                >
                  ✕ Sembunyikan & Kosongkan
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <div>
                  <label className="text-[8px] font-bold text-slate-500 uppercase">Raber 1</label>
                  <select value={formData.raberName} onChange={e => setFormData({ ...formData, raberName: e.target.value })} className="w-full p-1 border rounded border-slate-300 text-[9px] bg-white truncate outline-none">
                    <option value="">- Kosong -</option>
                    {dpjpProfiles.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-500 uppercase">Raber 2</label>
                  <select value={formData.raber2Name} onChange={e => setFormData({ ...formData, raber2Name: e.target.value })} className="w-full p-1 border rounded border-slate-300 text-[9px] bg-white truncate outline-none">
                    <option value="">- Kosong -</option>
                    {dpjpProfiles.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-500 uppercase">Raber 3</label>
                  <select value={formData.raber3Name} onChange={e => setFormData({ ...formData, raber3Name: e.target.value })} className="w-full p-1 border rounded border-slate-300 text-[9px] bg-white truncate outline-none">
                    <option value="">- Kosong -</option>
                    {dpjpProfiles.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. FORM SOAP + TOMBOL RESET MANDIRI */}
      <div className="space-y-1.5 pb-6">
        
        {/* A (ANALISA) */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[9px] font-black text-slate-600 uppercase">A (Analisa) / Dx</label>
            <button 
              type="button" 
              onClick={() => setFormData(prev => ({ ...prev, analysis: '' }))}
              className="text-[9px] text-red-600 hover:text-red-700 font-bold bg-red-50 hover:bg-red-100 border border-red-200 px-1.5 py-0.2 rounded transition cursor-pointer"
              title="Kosongkan kolom Analisa"
            >
              🗑️ Reset A
            </button>
          </div>
          <textarea 
            rows="2" 
            style={{ fieldSizing: 'content' }}
            value={formData.analysis} 
            onChange={e => setFormData({ ...formData, analysis: e.target.value })} 
            className="w-full p-1.5 border rounded-lg border-slate-300 text-[11px] outline-none focus:ring-1 focus:ring-indigo-500 bg-white resize-none min-h-[46px] max-h-[220px] overflow-y-auto leading-snug" 
            placeholder="Diagnosa medis..." 
          />
        </div>

        {/* P (PLANNING) */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[9px] font-black text-slate-600 uppercase">P (Planning)</label>
            <div className="flex items-center gap-1">
              <button 
                type="button" 
                onClick={() => setFormData(prev => ({ ...prev, planning: '' }))}
                className="text-[9px] text-red-600 hover:text-red-700 font-bold bg-red-50 hover:bg-red-100 border border-red-200 px-1.5 py-0.2 rounded transition cursor-pointer"
                title="Kosongkan kolom Planning"
              >
                🗑️ Reset P
              </button>
            </div>
          </div>

          <textarea 
            rows="2" 
            style={{ fieldSizing: 'content' }}
            value={formData.planning} 
            onChange={e => setFormData({ ...formData, planning: e.target.value })} 
            className="w-full p-1.5 border rounded-lg border-slate-300 text-[11px] outline-none focus:ring-1 focus:ring-indigo-500 bg-white resize-none min-h-[50px] max-h-[240px] overflow-y-auto leading-snug" 
            placeholder="Rencana tindakan, konsul, instruksi khusus..." 
          />

          {/* 🌟 BARISAN QUICK TAGS WARNA-WARNI (DR, TUBEX, PRC, BLPL, DLL) */}
          <div className="mt-1.5">
            <PlanningQuickTag onSelect={handleSelectQuickTag} />
          </div>
        </div>

        {/* RESEP OBAT (PERSISTEN) */}
        <div className="bg-rose-50 p-1.5 rounded-lg border border-rose-200">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] font-black text-rose-800 uppercase flex items-center gap-1">💊 Resep Obat </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] text-rose-500 font-semibold"></span>
              
              {/* 🌟 TOMBOL CPO (SINKRON DENGAN INDUK) */}
              <button 
                type="button" 
                onClick={handleOpenCPO}
                className="text-[9px] text-amber-700 hover:text-amber-800 font-bold bg-amber-100 hover:bg-amber-200 border border-amber-300 px-1.5 py-0.2 rounded transition cursor-pointer flex items-center gap-0.5 shadow-xs"
                title="Buka Lembar Catatan Pemberian Obat (CPO)"
              >
                💊 CPO
              </button>

              <button 
                type="button" 
                onClick={() => {
                  if (window.confirm("Kosongkan daftar resep obat paten pasien ini?")) {
                    setFormData(prev => ({ ...prev, currentPrescription: '' }));
                  }
                }}
                className="text-[9px] text-red-600 hover:text-red-700 font-bold bg-white hover:bg-red-50 border border-red-200 px-1.5 py-0.2 rounded transition cursor-pointer"
                title="Kosongkan kolom Resep Obat"
              >
                🗑️ Reset Obat
              </button>
            </div>
          </div>
          <textarea 
            rows="2" 
            style={{ fieldSizing: 'content' }}
            value={formData.currentPrescription} 
            onChange={e => setFormData({ ...formData, currentPrescription: e.target.value })} 
            className="w-full p-1.5 border rounded border-rose-300 text-[11px] outline-none bg-white font-mono resize-none min-h-[50px] max-h-[220px] overflow-y-auto leading-tight" 
            placeholder="- Ceftriaxone 1x2gr (Iv)&#10;- Ranitidin 2x1 (Iv)..." 
          />
        </div>

        {/* O (OBJEKTIF) */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[9px] font-black text-slate-600 uppercase">O (Objektif)</label>
            <div className="flex items-center gap-1">
              <button type="button" onClick={handleAppendLacak} className="px-1.5 py-0.2 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded text-[9px] font-black cursor-pointer animate-pulse">
                ⚠️ + Lacak/Lapor
              </button>
              <button 
                type="button" 
                onClick={() => setFormData(prev => ({ ...prev, objective: '' }))}
                className="text-[9px] text-red-600 hover:text-red-700 font-bold bg-red-50 hover:bg-red-100 border border-red-200 px-1.5 py-0.2 rounded transition cursor-pointer ml-1"
                title="Kosongkan kolom Objektif"
              >
                🗑️ Reset O
              </button>
            </div>
          </div>
          <textarea 
            rows="2" 
            style={{ fieldSizing: 'content' }}
            value={formData.objective} 
            onChange={e => setFormData({ ...formData, objective: e.target.value })} 
            className="w-full p-1.5 border rounded-lg border-slate-300 text-[11px] outline-none focus:ring-1 focus:ring-indigo-500 bg-white resize-none min-h-[50px] max-h-[240px] overflow-y-auto leading-snug" 
            placeholder="TTV, Hasil Lab/Rad, Pemeriksaan Fisik..." 
          />
        </div>

        {/* S (SUBJEKTIF) */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[9px] font-black text-slate-600 uppercase">S (Subjektif)</label>
            <button 
              type="button" 
              onClick={() => setFormData(prev => ({ ...prev, subjective: '' }))}
              className="text-[9px] text-red-600 hover:text-red-700 font-bold bg-red-50 hover:bg-red-100 border border-red-200 px-1.5 py-0.2 rounded transition cursor-pointer"
              title="Kosongkan kolom Subjektif"
            >
              🗑️ Reset S
            </button>
          </div>
          <textarea 
            rows="2" 
            style={{ fieldSizing: 'content' }}
            value={formData.subjective} 
            onChange={e => setFormData({ ...formData, subjective: e.target.value })} 
            className="w-full p-1.5 border rounded-lg border-slate-300 text-[11px] outline-none focus:ring-1 focus:ring-indigo-500 bg-white resize-none min-h-[46px] max-h-[200px] overflow-y-auto leading-snug" 
            placeholder="Keluhan pasien..." 
          />
        </div>
      </div>

      {/* POP-UP MODAL LAPOR WA */}
      {showLaporModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 w-full max-w-xs space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-black text-xs text-slate-800 flex items-center gap-1">
                <span>📢</span> Kirim Laporan WhatsApp
              </h3>
              <button onClick={() => setShowLaporModal(false)} className="text-slate-400 hover:text-red-500 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <p className="text-[10px] text-slate-500 leading-tight">
              Pilih tujuan pengiriman laporan SOAP untuk pasien <b>{formData.name || 'ini'}</b>:
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handleLaporWA('DPJP')}
                className="w-full p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-between shadow-sm transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">👨‍⚕️</span>
                  <div className="text-left">
                    <div className="leading-tight">Lapor ke DPJP</div>
                    <div className="text-[9px] font-normal opacity-80">{formData.dpjpName}</div>
                  </div>
                </div>
                <span>➔</span>
              </button>

              {[formData.raberName, formData.raber2Name, formData.raber3Name].map((rn, i) => rn ? (
                <button
                  key={i}
                  onClick={() => handleLaporWA('Raber', i)}
                  className="w-full p-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-between shadow-sm transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">🩺</span>
                    <div className="text-left">
                      <div className="leading-tight">Lapor ke Raber</div>
                      <div className="text-[9px] font-normal opacity-80">{rn}</div>
                    </div>
                  </div>
                  <span>➔</span>
                </button>
              ) : null)}  

              <button
                onClick={() => handleLaporWA('Forward')}
                className="w-full p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-between border border-slate-300 transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">👥</span>
                  <div className="text-left">
                    <div className="leading-tight">Forward Grup / Jaga</div>
                    <div className="text-[9px] font-normal text-slate-500">Pilih kontak / grup WA bebas</div>
                  </div>
                </div>
                <span>➔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP MODAL PULANG / DISCHARGE */}
      {showDischargeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 w-full max-w-xs space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-black text-xs text-slate-800 flex items-center gap-1">
                <span>🚪</span> Pulangkan Pasien (Kosongkan Bed)
              </h3>
              <button onClick={() => setShowDischargeModal(false)} className="text-slate-400 hover:text-red-500 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <p className="text-[10px] text-slate-600 leading-tight">
              Pilih alasan mutasi/keluar untuk <b>{formData.name}</b> (Bed {selectedBed}):
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handleExecuteDischarge('pulang')}
                className="w-full p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-between shadow-sm transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🏠</span>
                  <div className="text-left leading-tight">
                    <div>Pulang Biasa (KRS)</div>
                    <div className="text-[8px] font-normal opacity-80">Sembuh / Izin DPJP / APS</div>
                  </div>
                </div>
                <span>➔</span>
              </button>

              <button
                onClick={() => handleExecuteDischarge('pindah')}
                className="w-full p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-between shadow-sm transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🚑</span>
                  <div className="text-left leading-tight">
                    <div>Pindah Ruangan / Rujuk</div>
                    <div className="text-[8px] font-normal opacity-80">Alih rawat bangsal atau RS lain</div>
                  </div>
                </div>
                <span>➔</span>
              </button>

              <button
                onClick={() => handleExecuteDischarge('meninggal')}
                className="w-full p-2.5 rounded-xl bg-slate-800 hover:bg-black text-white font-bold text-xs flex items-center justify-between shadow-sm transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🕊️</span>
                  <div className="text-left leading-tight">
                    <div>Meninggal Dunia</div>
                    <div className="text-[8px] font-normal opacity-80">Arsipkan ke catatan kamar jenazah</div>
                  </div>
                </div>
                <span>➔</span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* MODAL PENGATURAN CETAK EOA DI DALAM COMPANION */}
      {showPrintConfig && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[90] animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 w-full max-w-xs space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-black text-xs text-slate-800 flex items-center gap-1">
                <span>🖨️</span> Pengaturan Cetak APOS
              </h3>
              <button onClick={() => setShowPrintConfig(false)} className="text-slate-400 hover:text-red-500 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 p-3 rounded-xl cursor-pointer hover:bg-slate-100 transition select-none">
              <input 
                type="checkbox" 
                checked={includeCpoInPrint} 
                onChange={e => setIncludeCpoInPrint(e.target.checked)} 
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              <span className="leading-tight">Sertakan Jadwal Jam Obat (CPO 3 Hari)</span>
            </label>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => executePrintStatic('A5')}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-xl shadow-sm transition cursor-pointer"
              >
                Cetak A5 (Standar)
              </button>
              <button
                onClick={() => executePrintStatic('A4')}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-xl shadow-sm transition cursor-pointer"
              >
                Cetak A4 (Besar)
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 📖 WADAH CETAK BUKU CM OTOMATIS (DARI INDUK) */}
      <div id="buku-cm-print" className="hidden">
        <BukuCMTable 
          records={wardPatients} 
          roomList={currentBedList} 
        />
      </div>
      {/* 💊 MODAL CPO DI JENDELA LUAS (POPOUT VIA REACT PORTAL) */}
      {isMarModalOpen && cpoContainer && createPortal(
        <MedicationMarModal
          isOpen={isMarModalOpen}
          onClose={handleCloseCPO}
          record={marSelectedRecord}
          allRecords={wardPatients}
          db={db}
          currentUser={currentUser}
          firebaseConfig={firebaseConfig}
        />,
        cpoContainer
      )}

    </div>
  );
}