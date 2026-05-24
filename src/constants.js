// --- DATA STATIS ---

export const LEFT_ROOMS = ['K1A', 'K1B', 'K3A', 'K3B', 'K5A', 'K5B', 'K7A', 'K8A', 'K9A', 'K11A', 'K12A', 'K14A'];
export const RIGHT_ROOMS = ['K2A', 'K2B', 'K4A', 'K4B', 'K6A', 'K6B', 'K10A', 'K10B', 'K13A', 'K13B', 'K15A', 'K15B'];
export const ROOM_LIST = [...LEFT_ROOMS, ...RIGHT_ROOMS];

export const DEFAULT_DPJP_DATA = [
    { name: 'dr. Delvi, Sp.PD', waNumber: '6281283812875' },
    { name: 'dr. Susilo, Sp.PD', waNumber: '6282119395835' },
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
];

export const LAB_CHECKS = [
    'Darah Rutin (DR)', 'HJL', 'Masa Pendarahan (BT/CT)', 'CA125', 'PT/APTT/INR',
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
    'Thorax', 'Thorax Lateral', 'BNO Polos', 'BNO 3 Posisi', 'Lumbosacral', 'Cervical', 'Foto Ekstremitas',
    'USG Whole Abdomen', 'USG Hepatobilier/Upper Abdomen', 'USG Lower/Ginjal Abdomen', 'USG Thorax', 'USG Tiroid', 'USG Kandung Empedu', 'USG Jantung', 'USG Vaskular Doppler',
    'CT Scan Kepala Kontras', 'CT Scan Kepala non-Kontras', 'CT Scan Thorax Kontras', 'CT Scan Thorax non-Kontras', 'CT Scan Abdomen kontras',
    'CT Scan Abdomen non-kontras', 'CT Scan Vertebra', 'CT Angiography', 'CT Scan Cardiac',
    'MRI Kepala', 'MRI Vertebra', 'MRI Lutut', 'MRI Pelvis',
    'Echocardiography', 'Endoskopi', 'Kolonoskopi', 'Bronkoskopi', 'Angiography Koroner'
];

export const PROCEDURES = [
    'Pasang Infus', 'Pasang Kateter', 'Pasang NGT', 'Nebulizer', 'Oksigenasi', 'Pemasangan Ventilator',
    'EKG', 'Ganti Balutan', 'Suction', 'Injeksi Extra', 'Syringe Pump', 'Hemodialisa (HD)', 
    'Rawat Luka', 'Angkat Jahitan', 'Spooling NGT', 'Spooling Kateter', 'Bladder Training', 'Biopsi Sumsum Tulang',
    'Torakosintesis', 'Pungsi Efusi Pleura', 'Pungsi Ascites/Parasintesis', 'Pungsi Lumbal', 'Aspirasi Sendi',
    'Nefrostomi', 'Trakeostomi', 'Debridemen', 'Monitor UOP', 'Balance Cairan', 'Pasang/Repair CDL'
];
export const MEDICATIONS = [
    'Koreksi KCL  mEq +  500 ml/8 Jam,  siklus on ke', 'Koreksi Meylon  mEq + Ns  100 ml/j', 'Koreksi CaGluconas  gr + D5 100ml', 'Bolus Novorapid 10 iu + D40 2 flash',
    'Drip Insulin/Novorapid  iu/j', 'Drip Lasix  cc/j', 'Drip Perdipine/Nicardipine  mcg, Kec.  cc/j, Bb  kg', 'Drip vascon/Norepinephrine  mcg, Kec.  cc/j, Bb  kg',
    'Drip Amiodarone', 'Drip Fentanyl', 'Injeksi Extra Lasix', 'Trnfs  PRC, on ke , post ke , premed: , Postmed:', 'Trnfs  TC, on ke , post ke , premed: , Postmed:',
    '3 Way', '2 Line Infus', 'Trnfs Albumin', 'Drip Heparin', 'Drip Dopamine  mcg, Kec.  cc/j, Bb  kg', 'Drip Dobutamine  mcg, Kec.  cc/j, Bb  kg', 'Drip Epinephrine  mcg, Kec.  cc/j, Bb  kg',
    'Drip pantoprazole 8 mg/j', 'IVFD: clinimix 500 + Clinoleic 250', 'IVFD: Kidmin', 'IVFD: Asering', 'IVFD: Futrolit', 'IVFD: Bfluid', 'IVFD: D5%', 'IVFD: D10%', 'IVFD: NaCl 0.9%', 'IVFD: RL',
];