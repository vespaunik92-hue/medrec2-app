// ==========================================
// KODE LAMA MELATI (BIARKAN SEPERTI ASLINYA)
// ==========================================

export const LEFT_ROOMS = ['K1KM', 'K1P', 'K3KM', 'K3P', 'K5KM', 'K5P', 'K7', 'K8', 'K9', 'K11', 'K12', 'K14'];
export const RIGHT_ROOMS = ['K2P', 'K2KM', 'K4P', 'K4KM', 'K6P', 'K6KM', 'K10P', 'K10KM', 'K13P', 'K13KM', 'K15P', 'K15KM'];
export const ROOM_LIST = [...LEFT_ROOMS, ...RIGHT_ROOMS];

// ==========================================
// ✨ TAMBAHAN BARU: DENAH DAHLIA
// ==========================================
export const DAHLIA_LEFT_ROOMS = ['10', '9', '8', '7', '6'];
export const DAHLIA_RIGHT_ROOMS = ['5', '4', '3', '2', '1'];
export const DAHLIA_ROOM_LIST = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

// --- KONFIGURASI RUANG TERATAI (22 BED) ---
export const TERATAI_ROOMS = [
    'K1A', 'K1B', 
    'K2A', 'K2B', 'K2C', 'K2D', 
    'K3A', 'K3B', 'K3C', 'K3D', 
    'K4A', 'K4B', 
    'K5A', 'K5B', 'K5C', 'K5D', 
    'K6A', 'K6B', 'K6C', 'K6D', 
    'K7A', 'K7B' // (Isolasi)
];

// Kita bagi dua untuk tampilan lorong (Kiri 12 bed, Kanan 10 bed)
export const TERATAI_LEFT_ROOMS = [
    'K4A', 'K4B', 'K3C', 'K3D', 'K3A', 'K3B', 'K2C', 'K2D', 'K2A', 'K2B', 'K1A', 'K1B'
];
export const TERATAI_RIGHT_ROOMS = [
    'K5C', 'K5D', 'K5A', 'K5B', 'K6C', 'K6D', 'K6A', 'K6B', 'K7A', 'K7B'
];

// --- KONFIGURASI RUANG ANYELIR (26 BED) ---
export const ANYELIR_ROOMS = [
    'K1A', 'K1B', 'K1C', 'K1D', 
    'K2A', 'K2B', 'K2C', 'K2D', 
    'K3A', 'K3B', 'K3C', 'K3D', 
    'K4A', 'K4B', 'K4C', 'K4D', 
    'K5A', 'K5B', 'K5C', 'K5D', 
    'K6A', 'K6B', 'K6C', 'K6D', 
    'ISO-A', 'ISO-B' // (Isolasi)
];

// Dibagi menjadi dua sisi lorong agar seimbang di layar laptop (Kiri 16 Bed, Kanan 10 Bed)
export const ANYELIR_LEFT_ROOMS = [
    'K1A', 'K1B', 'K1C', 'K1D', 'K2A', 'K2B', 'K2C', 'K2D', 'K3A', 'K3B', 'K3C', 'K3D', 'K4A', 'K4B', 'K4C', 'K4D'
];
export const ANYELIR_RIGHT_ROOMS = [
    'ISO-A', 'ISO-B', 'K6C', 'K6D', 'K6A', 'K6B', 'K5C', 'K5D', 'K5A', 'K5B'
];

// --- KONFIGURASI RUANG ANGGREK (22 BED) ---
export const ANGGREK_ROOMS = [
    'K1A', 'K1B', 'K2A', 'K2B', 'K3A', 'K3B', 'K4A', 'K4B', 'K5A', 'K5B',
    'K6A', 'K6B', 'K7A', 'K7B', 'K8A', 'K8B', 'K9A', 'K9B', 'K10A', 'K10B',
    'ISO-A', 'ISO-B' // (Isolasi)
];

// Dibagi menjadi dua sisi lorong (Kiri 12 Bed, Kanan 10 Bed)
export const ANGGREK_LEFT_ROOMS = [
    'ISO-A', 'ISO-B', 'K10A', 'K10B', 'K9A', 'K9B', 'K8A', 'K8B', 'K7A', 'K7B', 'K6A', 'K6B'
];
export const ANGGREK_RIGHT_ROOMS = [
    'K1A', 'K1B', 'K2A', 'K2B', 'K3A', 'K3B', 'K4A', 'K4B', 'K5A', 'K5B'
];

// ==========================================
// ✨ TAMBAHAN BARU: MASTER KONFIGURASI BANGSAL
// ==========================================
// Objek ini yang nanti jadi "otak" pergantian ruangan di Tahap 2
export const WARD_CONFIG = {
    'MELATI': {
        name: 'Melati',
        leftRooms: LEFT_ROOMS,      // Mengambil denah Melati lama
        rightRooms: RIGHT_ROOMS,    // Mengambil denah Melati lama
        roomList: ROOM_LIST         // Mengambil daftar kamar Melati lama
    },
    'DAHLIA': {
        name: 'Dahlia',
        leftRooms: DAHLIA_LEFT_ROOMS,
        rightRooms: DAHLIA_RIGHT_ROOMS,
        roomList: DAHLIA_ROOM_LIST
    },
    // ✨ TAMBAHAN BARU
    'TERATAI': {
        name: 'Teratai',
        roomList: TERATAI_ROOMS,
        leftRooms: TERATAI_LEFT_ROOMS,
        rightRooms: TERATAI_RIGHT_ROOMS
    },

    // ✨ TAMBAHAN BARU: ANYELIR
    'ANYELIR': {
        name: 'Anyelir',
        roomList: ANYELIR_ROOMS,
        leftRooms: ANYELIR_LEFT_ROOMS,
        rightRooms: ANYELIR_RIGHT_ROOMS
    },

    // ✨ TAMBAHAN BARU: ANGGREK
    'ANGGREK': {
        name: 'Anggrek',
        roomList: ANGGREK_ROOMS,
        leftRooms: ANGGREK_LEFT_ROOMS,
        rightRooms: ANGGREK_RIGHT_ROOMS
    }
};

// ✨ 1. KAMUS NILAI NORMAL LAB (Sudah disesuaikan standar RS)
export const LAB_NORMAL_RANGES = {
    // --- HEMATOLOGI (Darah Rutin & Pembekuan) ---
    'Hb': { min: 12, max: 16 },       
    'Leu': { min: 4.5, max: 11 },         // 4.500 - 11.000 (Disingkat)
    'Trmbsit': { min: 150, max: 450 },    // 150.000 - 450.000 (Disingkat)
    'Ht': { min: 37, max: 47 }, 
    'Eritrosit': { min: 4.7, max: 6.1 },  // Tambahan jaga-jaga
    'Retikulosit': { min: 0.5, max: 1.5 },
    'LED': { min: 0, max: 20 },
    'BT': { min: 1, max: 6 },     
    'CT': { min: 5, max: 15 },    
    'PT': { min: 10, max: 13 },
    'APTT': { min: 25, max: 35 },
    'INR': { min: 0.8, max: 1.2 },

    // --- KIMIA KLINIK (Gula, Ginjal, Hati) ---
    'GDS': { min: 70, max: 140 },         
    'GDP': { min: 70, max: 126 },
    '2JPP': { min: 70, max: 140 },
    'HbA1c': { min: 4.0, max: 5.7 },
    'Ur': { min: 10, max: 50 },           
    'Cr': { min: 0.5, max: 1.1 },       
    'SGOT': { min: 0, max: 37 },
    'SGPT': { min: 0, max: 40 },
    'Alb': { min: 3.5, max: 5.0 },        
    'Globulin': { min: 2.0, max: 3.5 },
    'Bil.Total': { min: 0.1, max: 1.2 },    
    'Bil.Direk': { min: 0.0, max: 0.3 },
    'Bil.Indirek': { min: 0.1, max: 0.9 },
    'Asam Urat': { min: 3.5, max: 7.2 },

    // --- ELEKTROLIT & GAS DARAH (AGD) ---
    'Na': { min: 135, max: 145 },
    'K': { min: 3.5, max: 5.5 },
    'Cl': { min: 96, max: 106 },
    'Ca': { min: 8.5, max: 10.5 },   
    'Lactate': { min: 0.5, max: 2.2 },
    'pH': { min: 7.35, max: 7.45 },
    'pCO2': { min: 35, max: 45 },
    'pO2': { min: 75, max: 100 },
    'HCO3': { min: 22, max: 26 },

    // --- PANEL LIPID ---
    'Kolesterol': { min: 0, max: 200 },
    'LDL': { min: 0, max: 100 },
    'HDL': { min: 40, max: 100 }, 
    'Trigliserida': { min: 0, max: 150 },

    // --- JANTUNG, INFEKSI, & MARKER SPESIFIK ---
    'Procalcitonin': { min: 0.0, max: 0.15 },
    'Ferritin': { min: 10, max: 300 },
    'D-Dimer': { min: 0, max: 500 },
    'CRP': { min: 0, max: 5 },            
    'Troponin I': { min: 0.0, max: 0.04 },
    'Troponin T': { min: 0.0, max: 0.01 },
    'CK-MB': { min: 0, max: 25 },
    'ProBNP': { min: 0, max: 125 },
    'TSH': { min: 0.4, max: 4.0 },
    'FT4': { min: 0.9, max: 2.3 },
    'CA125': { min: 0, max: 35 },
    'CD4': { min: 500, max: 1500 }
};

export const DEFAULT_DPJP_DATA = [
    { name: 'dr. Delvi, Sp.PD', waNumber: '6281283812875' },    
    { name: 'dr. Dian Ekowati, Sp.PD', waNumber: '6281210680279' },
    { name: 'dr. Priyo, Sp.PD', waNumber: '62811220364' },
    { name: 'dr. Risa, Sp.PD', waNumber: '6281316198500' },
    { name: 'dr. Evan, Sp.P', waNumber: '6281210100626' },
    { name: 'dr. Evi, Sp.JP', waNumber: '628112223938' },
    { name: 'dr. Iman, Sp.JP', waNumber: '6281395546887' },
    { name: 'dr. Murti, Sp.S', waNumber: '6281383315383' },
    { name: 'dr. Zuhaira, Sp.S', waNumber: '6282121992620' },
    { name: 'dr. Ganda, Sp.N', waNumber: '6282121759729' },
    { name: 'dr. Agam, Sp.B', waNumber: '6282218321999' },
    { name: 'dr. Daniel, Sp.B', waNumber: '6281398906655' },
    { name: 'dr. Synthia, Sp.B', waNumber: '628122004566' },
    { name: 'dr. Irwan, Sp.B', waNumber: '6285721483198' },
    { name: 'dr. Eka, Sp.OT', waNumber: '6281380733477' },
    { name: 'dr. Gamal, Sp.OT', waNumber: '6281312208478' },
    { name: 'dr. Andre, Sp.BS', waNumber: '6287822462203' },
    { name: 'dr. Joko, Sp.U', waNumber: '6281322819326' },
    { name: 'dr. Eric, Sp.OG', waNumber: '628156226961' },
    { name: 'dr. Huda, Sp.OG', waNumber: '628112294881' },
    { name: 'dr. Sella, Sp.OG', waNumber: '6282226862504' },
    { name: 'dr. Jamal, Sp.KJ', waNumber: '6282116190858' },
    { name: 'dr. Virama, Sp.KJ', waNumber: '628121078143' },
    { name: 'dr. Sri Siswanti, Sp.Kk', waNumber: '6281227153161' },
    { name: 'drg. Dian Maifara, Sp.BM', waNumber: '62811119879' },
    { name: 'dr. Ayuning, Sp.M', waNumber: '6281320657281' },
    { name: 'dr. Sudarmanto, Sp.M', waNumber: '6281287083336' },
    { name: 'dr. Erick Maulana Yusup, Sp.T.H.T.K.L', waNumber: '628112225992' },
    { name: 'drg. Septania Hermanti', waNumber: '6281802290090' },
    { name: 'drg. Raden Aan Harjany', waNumber: '628122055933' },
    { name: 'dr. Dian Herdiansyah, Sp.KFR', waNumber: '62817211317' },
    { name: 'dr. Dede Lia Marlia, Sp. A', waNumber: '628121280535'},
    { name: 'dr. Tommy Nugrahadi, Sp.A', waNumber: '6282115159220' },
    { name: 'dr. Yogi Agustian, Sp.A', waNumber: '6281320033339' },
];

export const LAB_CHECKS = [
    'Darah Rutin (DR)', 'HJL', 'Masa Pendarahan (BT/CT)', 'CA125', 'CA19-9', 'PT/APTT/INR',
    'GDS', 'GDP-2JPP', 'HbA1c', 'TSH/FT4', 'Procalcitonin', 'Ferritin', 'D-Dimer', 'Retikulosit',
    'Ureum-Creatinin', 'SGOT-SGPT', 'Albumin/Globulin', 'Bilirubin Total/Direk',
    'Elektrolit (Na/K/Cl)', 'Kalsium (Cal)', 'Analisa Gas Darah (AGD)', 'Lactate', 'igG-igM Cikungunya',
    'Hemokultur', 'Darah Tepi', 'LED', 'PCR Covid-19', 'Swab Antigen', 'Rapid Test Covid-19',
    'Sero Dengue (NS1)', 'Malaria (Tetesan Darah)', 'Widal Test', 'Fungsi Tiroid Lengkap',
    'Fungsi Hati Lengkap', 'Fungsi Ginjal Lengkap', 'Panel Lipid Lengkap',
    'Profil Lipid (Kolesterol)', 'Asam Urat', 'Sputum', 'CD4', 'igG-igM Dengue', 'igG-igM Leptospirosis',
    'Urin', 'Feses', 'Kultur Darah', 'TCM TB', 'HBsAg/Anti-HBs/Anti-HCV/Anti-HIV', 'serologi morbilli',
    'Troponin T/I', 'CK-MB', 'Tubex', 'Titer Widal', 'CRP Kuantitatif', 'ProBNP', 'SADT'    
];

export const RADIOLOGY_CHECKS = [
    'Thorax', 'Thorax Lateral', 'BNO Polos', 'BNO 3 Posisi', 'Lumbosacral', 'Cervical', 'Foto Ekstremitas', 'Rontgen Cruris', 'Rontgen OA Genou',
    'USG Whole Abdomen', 'USG Hepatobilier/Upper Abdomen', 'USG Lower/Ginjal Abdomen', 'USG Thorax', 'USG Tiroid', 'USG Kandung Empedu', 'USG Jantung', 'Echocardiography', 'USG Vaskular Doppler',
    'CT Scan Kepala Kontras', 'CT Scan Kepala non-Kontras', 'CT Scan Thorax Kontras', 'CT Scan Thorax non-Kontras', 'CT Scan Abdomen kontras',
    'CT Scan Abdomen non-kontras', 'CT Scan Vertebra', 'CT Angiography', 'CT Scan Cardiac', 'CT Urografi kontras', 'CT Urografi non-kontras',
    'CT Nasofaring kontras', 'CT Nasofaring non-kontras', 'CT Sinus',
    'MRI Kepala', 'MRI Vertebra', 'MRI Lutut', 'MRI Pelvis',
    'Endoskopi', 'Kolonoskopi', 'Bronkoskopi', 'Angiography Koroner'
];

export const PROCEDURES = [
    'Pasang Infus', 'Pasang Kateter', 'Pasang NGT', 'Nebulizer', 'Oksigenasi', 'Pemasangan Ventilator',
    'EKG', 'Ganti Balutan', 'Suction', 'Injeksi Extra', 'Syringe Pump', 'Hemodialisa (HD)', 'Fisioterapi',
    'Rawat Luka', 'Angkat Jahitan', 'Spooling NGT', 'Spooling Kateter', 'Bladder Training', 'Biopsi Sumsum Tulang',
    'Torakosintesis', 'Pungsi Efusi Pleura', 'Pungsi Ascites/Parasintesis', 'Pungsi Lumbal', 'Aspirasi Sendi',
    'Nefrostomi', 'Trakeostomi', 'Debridemen', 'Monitor UOP', 'Balance Cairan', 'Pasang/Repair CDL', 'Phlebotomi'
];
export const MEDICATIONS = [
    'Koreksi KCL  mEq +  500 ml/8 Jam,  siklus on ke', 'Koreksi Meylon  mEq + Ns  100 ml/j', 'Koreksi CaGluconas  gr + D5 100ml, Bolus Novorapid 10 iu + D40 2 flash',
    'Drip Insulin/Novorapid  iu/j', 'Drip Lasix  cc/j', 'Drip Perdipine/Nicardipine  mcg, Kec.  cc/j, Bb  kg', 'Drip vascon/Norepinephrine  mcg, Kec.  cc/j, Bb  kg',
    'Drip Amiodarone', 'Drip Fentanyl', 'Injeksi Extra Lasix', 'Trnfs  PRC, on ke , post ke , premed: , Postmed: ', 'Trnfs  TC, on ke , post ke , premed: , Postmed:',
    '3 Way', '2 Line Infus', 'Trnfs Albumin', 'Drip Heparin', 'Drip Dopamine  mcg, Kec.  cc/j, Bb  kg', 'Drip Dobutamine  mcg, Kec.  cc/j, Bb  kg', 'Drip Epinephrine  mcg, Kec.  cc/j, Bb  kg',
    'Drip pantoprazole 8 mg/j', 'IVFD: clinimix 500 + Clinoleic 250', 'IVFD: Kidmin', 'IVFD: Asering', 'IVFD: Futrolit', 'IVFD: Bfluid', 'IVFD: D5%', 'IVFD: D10%', 'IVFD: NaCl 0.9%', 'IVFD: RL',
    'IVFD: NaCl 3%'
];

// ✨ MASTER DATABASE ANTIBIOTIK (PPRA)
export const ANTIBIOTICS_DB = [
    'seftriakson', 'ceftriaxon', 'broadced', 'terfacef',
    'meropenem', 'merosan',
    'azitro', 'azithro', 'zithromax',
    'levoflok', 'levoflox', 'cravit',
    'cipro', 'baquinor',
    'amoksi', 'amoxi', 'amoxsan',
    'sefotaksim', 'cefotaxime',
    'cefoperazone', 'sulbactam', 'sulbaktam',
    'metronidazol', 'flagyl',
    'gentamisin', 'gentamicin',
    'amikasin', 'amikacin',
    'ampisilin', 'ampicillin', 'viccillin',
    'klindamisin', 'clindamycin',
    'cefepim', 'cefspan', 'cefixim', 'sefiksim', 'ceftriaxone',
    'vancomycin', 'vanco', 'vancocin',
    'linezolid', 'zyvox',
    'tigecycline', 'tygacil',
    'colistin', 'colimycin',
    'fosfomycin', 'monurol',
    'daptomycin', 'cubicin',
    // === ANTIBIOTIK BARU ===
    'ceftazidime', 'fortum', 'cetazidim',
    'bactrim', 'septra', 'tmp-smx', 'trimetoprim',
    'rifampicin', 'rifampin', 'rifadin',
    'polymyxin b',
    'oxacillin', 'crystapen',
    'tobramycin', 'nebcin', 'tobral',
    'tetracycline', 'tetracyn',
    'quinupristin', 'dalfopristin', 'synercid',
    'piperacillin', 'tazobactam', 'zosyn', 'tazocin',
    'nitrofurantoin', 'macrodantin', 'furadantin',
    'moxifloxacin', 'avelox',
    'erythromycin', 'ilosone',
    'doxycycline', 'vibramycin', 'doxy',
    'imipenem', 'tienam',
    'cefoxitin', 'mefoxin',
    'cefazolin', 'kefzol', 'ancef',
    'aztreonam', 'azactam',
    'ertapenem', 'invanz',
    'doripenem', 'doribax',
    'benzylpenicillin', 'penicillin g',
    'amoxicillin', 'clavulanic', 'augmentin',
    'ciprofloxacin',
    'levofloxacin'
];

export const MEDICATION_TRANSLATOR = {
    // ⚠️ KUNCI (KEY) SEBELAH KIRI WAJIB HURUF KECIL SEMUA AGAR TERBACA SISTEM!
    "nasetil sisteine": "Nac",
    "n-asetil sisteine": "Nac",
    "n-acetylcysteine": "Nac",
    "seftriakson": "Seftriakson",
    "parasetamol": "Paracetamol",
    "pantoprazol": "Pantoprazole",
    "ketorolak": "Ketorolac",
    "metronidazol": "Metronidazole",
    "sefotaksim": "Sefotaksim",
    "ceftriaxone": "Ceftriaxone",
    "cefepim": "Cefepim",
    "levofloxacin": "Levofloxacin",
    "ciprofloxacin": "Ciprofloxacin",
    "combiven": "Combiven",
    "pulmicort": "Pulmicort",
    "nacl 0.9%": "IVFD: NaCl 0.9%",
    "dextrose 5%": "D5%",
    "dextrose 10%": "D10%",
    "ringer laktat": "IVFD: RL",
    // === ANTIBIOTIK BARU ===
    "ceftazidime": "Ceftazidime",
    "trimethoprim/sulfamethoxazole": "TMP-SMX",
    "tigecycline": "Tigecycline",
    "rifampicin": "Rifampicin",
    "polymyxin b": "Polymyxin B",
    "oxacillin": "Oxacillin",
    "vancomycin": "Vancomycin",
    "tobramycin": "Tobramycin",
    "tetracycline": "Tetracycline",
    "quinupristin/dalfopristin": "Q-D",
    "piperacillin/tazobactam": "Pip-Tazo",
    "nitrofurantoin": "Nitrofurantoin",
    "moxifloxacin": "Moxifloxacin",
    "linezolid": "Linezolid",
    "imipenem": "Imipenem",
    "erythromycin": "Erythromycin",
    "doxycycline": "Doxycycline",
    "clindamycin": "Clindamycin",
    "cefoxitin": "Cefoxitin",
    "cefoperazone/sulbactam": "Cefoperazone/Sulbactam",
    "cefazolin": "Cefazolin",
    "aztreonam": "Aztreonam",
    "ampicillin": "Ampicillin",
    "amikacin": "Amikacin",
    // === INJEKSI (IVFD) ===
    "meropenem": "Meropenem",
    "gentamicin": "Gentamicin",
    "ertapenem": "Ertapenem",
    "doripenem": "Doripenem",
    "cefotaxime": "Cefotaxime",
    "benzylpenicillin": "B-Penicillin",
    "ampicillin/sulbactam": "Ampi/Sulb",
    "amoxicillin/clavulanic acid": "Amoxi/Clav",
};

export const LAB_TRANSLATOR = {
    "r/ dr": "Lab. R/ Darah Rutin",
    "dr": "Lab. R/ Darah Rutin",
    "tubex": "Lab. R/ Tubex",
    "gds": "Lab. R/ GDS",    
    // Tambahkan tes lab lain di sini...
};

// ✨ KAMUS PATTERN REGEX UNTUK PARSING LAB DARI TEKS
export const LAB_PATTERNS = {
    // Hematologi
    'Hb': /(?:Hb|Hemoglobin)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'Leu': /(?:Leu|Leukosit|WBC)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'Trmbsit': /(?:Plt|Trombosit|Trombo|Trmbsit|Platelets?)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'Ht': /(?:Ht|Hematokrit)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'Eritrosit': /(?:Eri|Eritrosit|RBC)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'Retikulosit': /(?:Retikulosit)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'LED': /(?:LED|ESR|Laju Endap)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'BT': /(?:BT|Bleeding Time|Masa Perdarahan)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'CT': /(?:CT|Clotting Time|Masa Pembekuan)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'PT': /(?:PT)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'APTT': /(?:APTT)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'INR': /(?:INR)[\s:.-]*(\d+(?:[.,]\d+)?)/i,

    // Kimia Klinik
    'GDS': /(?:GDS|Gula Darah|Gula Darah Sewaktu|Sewaktu)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'GDP': /(?:GDP|Glukosa Puasa|Puasa)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    '2JPP': /(?:2JPP|2.?JPP|Jam PP|Post Prandial)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'HbA1c': /(?:HbA1c|Hemoglobin A1c|Glikohemoglobin)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'Ur': /(?:Ur|Ureum|BUN)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'Cr': /(?:Cr|Kreatinin|Creatinin)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'SGOT': /(?:SGOT|AST)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'SGPT': /(?:SGPT|ALT)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'Alb': /(?:Alb|Albumin)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'Globulin': /(?:Globulin)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'Bil.Total': /(?:Bilirubin Total|Total Bil|Bil Total)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'Bil.Direk': /(?:Bilirubin Direk|Direk|Bil Direk)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'Bil.Indirek': /(?:Bilirubin Indirek|Indirek|Bil Indir)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'Asam Urat': /(?:Asam Urat|Uric Acid)[\s:.-]*(\d+(?:[.,]\d+)?)/i,

    // ==========================================
// FIX ABSOLUT: KALIUM VS KALSIUM ANTI-BENTROK
// ==========================================
    'Na': /\b(?:Na|Natrium)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    
    // 🔥 FIX: Kalium hanya mau menerima huruf 'K' tunggal atau kata 'Kalium', dan MENOLAK kata 'Kalsium'
    'K': /\bK\b(?!alsium)[\s:.-]*(\d+(?:[.,]\d+)?)|(?:\bKalium)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    
    'Cl': /\b(?:Cl|Clorida|Chloride|Klorida)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    
    // Ca juga bisa menangkap penulisan Kalsium, Calcium, atau Ca
    'Ca': /\b(?:Kalsium|Calcium|Ca)\b[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    
    'Lactate': /\b(?:Lactate|Laktat)[\s:.-]*(\d+(?:[.,]\d+)?)/i,

    // Gas Darah
    'pH': /(?:pH)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'pCO2': /(?:pCO2|PCO2)[\s:.-]*(\d+(?:[.,]\d+)?)/i,    
    'HCO3': /(?:HCO3)[\s:.-]*(\d+(?:[.,]\d+)?)/i,

    // Panel Lipid
    'Kolesterol': /(?:Kolesterol|Total Chol|Cholesterol)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'LDL': /(?:LDL)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'HDL': /(?:HDL)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'Trigliserida': /(?:Trigliserida|Triglyceride|TG)[\s:.-]*(\d+(?:[.,]\d+)?)/i,

    // Marker Spesifik
    'Procalcitonin': /(?:Procalcitonin|PCT)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'Ferritin': /(?:Ferritin)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'D-Dimer': /(?:D-Dimer|DD)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'CRP': /(?:CRP|C-Reactive)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'Troponin I': /(?:Troponin I|Trop-I|Troponin I)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'Troponin T': /(?:Troponin T|Trop-T|Troponin T)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'CK-MB': /(?:CK-MB|CKMB)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'ProBNP': /(?:ProBNP|BNP)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'TSH': /(?:TSH)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'FT4': /(?:FT4|Free T4)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'CA125': /(?:CA-125|CA125)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'CA19-9': /(?:CA-19-9|CA19-9)[\s:.-]*(\d+(?:[.,]\d+)?)/i,
    'CD4': /(?:CD4)[\s:.-]*(\d+(?:[.,]\d+)?)/i,

    // Lab Kualitatif (hasil kata-kata)
    'Tubex': /(?:Tubex|Tube Agglutination)[\s:.-]*(.+?)(?:\n|$)/i,
    'Gram/Sputum': /(?:(?:Gram|Sputum|BTA|Pewarnaan).*)/gi,  // Multi-line: capture semua baris Gram/Sputum/BTA
    'TCM': /(?:TCM|GeneXpert|MTB)[\s:.-]*(.+?)(?:\n|$)/i,
    'HIV': /(?:HIV)[\s:.-]*(.+?)(?:\n|$)/i,
    'HBsAg': /(?:HBsAg|Hepatitis B)[\s:.-]*(.+?)(?:\n|$)/i,
    'Anti-HCV': /(?:Anti-HCV|Hepatitis C)[\s:.-]*(.+?)(?:\n|$)/i,
    'Widal': /(?:Widal|Typhoid)[\s:.-]*(.+?)(?:\n|$)/i,
    'Kultur': /(?:Kultur|Culture)[\s:.-]*(.+?)(?:\n|$)/i,
    'MDT': /(?:MDT|Morfologi Darah Tepi|Apusan Darah)[\s:.-]*(.+?)(?:\n|$)/i,
};

// ✨ LOW IS BAD - lab yang rendahnya yang berbahaya
export const LAB_LOW_IS_BAD = [
    'Hb', 'Trmbsit', 'Ht', 'Eritrosit', 'Alb', 'Globulin',
    'Ferritin', 'Fe', 'TSAT', 'CD4', 'HDL'
];

// ✨ TUBEX KHUSUS - >= 4 = positif (merah)
export const LAB_TUBEX_POSITIVE_THRESHOLD = 4;

export const LAB_DICTIONARY = [
    { name: "Hb", keywords: ["hb", "hemoglobin", "hgb"] },
    { name: "Ht", keywords: ["ht", "hematokrit", "hct"] },
    { name: "Leukosit", keywords: ["leukosit", "leu", "wbc"] },
    { name: "Trombosit", keywords: ["trombosit", "trombo", "plt", "trmbsit"] },
    { name: "Eritrosit", keywords: ["eritrosit", "rbc"] },
    { name: "GDS", keywords: ["gula darah sewaktu", "gds"] },
    { name: "GDP", keywords: ["gula darah puasa", "gdp"] },
    { name: "2JPP", keywords: ["2jpp", "post prandial", "pp"] },
    { name: "SGOT", keywords: ["sgot", "ast"] },
    { name: "SGPT", keywords: ["sgpt", "alt"] },
    { name: "Bil.Total", keywords: ["bilirubin total", "bil total", "bil.total"] },
    { name: "Bil.Indirek", keywords: ["bilirubin indirek", "bil indirek", "indirek"] },
    { name: "Bil.Direk", keywords: ["bilirubin direk", "bil direk", "direk"] },
    { name: "Ureum", keywords: ["ureum", "bun"] },
    { name: "Kreatinin", keywords: ["kreatinin", "krea", "cr"] },
    { name: "Na", keywords: ["natrium", "\\bna\\b"] },
    { name: "K", keywords: ["kalium", "\\bk\\b"] },
    { name: "Cl", keywords: ["klorida", "\\bcl\\b"] },
    // ✨ FIX: Menambahkan \\b pada Ca agar tidak keliru mendeteksi kata "cara" atau "campur"
    { name: "Ca", keywords: ["kalsium", "calcium", "\\bca\\b"] }
];