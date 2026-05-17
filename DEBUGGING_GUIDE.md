# 🔍 Debugging & Troubleshooting: Master Data System

## 📊 Cara Melihat & Manage localStorage

### 1. Buka Browser DevTools
```
Chrome/Firefox/Edge: Tekan F12 atau Ctrl+Shift+I
Safari: Cmd+Option+I
```

### 2. Navigasi ke Storage
```
Chrome/Edge:   Application tab → Storage → Local Storage → select your site
Firefox:       Storage tab → Local Storage → select your site
Safari:        Storage tab → Local Storage
```

### 3. Keys yang Ada (Master Data)
```
masterLabs
masterRads
masterProcedures
masterMedications

Contoh value:
masterLabs = ["Darah Rutin","HJL","Masa Pendarahan"]
```

---

## 🛠️ Troubleshooting Commands

### Clear Master Data (di Console)
```javascript
// Clear satu-satu
localStorage.removeItem('masterLabs');
localStorage.removeItem('masterRads');
localStorage.removeItem('masterProcedures');
localStorage.removeItem('masterMedications');

// Atau clear semua (hati-hati!)
localStorage.clear(); // ⚠️ Ini akan hapus juga Cashflow data!

// Lihat apa yang ada
console.log(localStorage);

// Atau export untuk debug
JSON.parse(localStorage.getItem('masterLabs'));
```

### Check Firebase vs localStorage Status
```javascript
// Di Console, copy-paste ini:
console.log('=== MASTER DATA STATUS ===');
console.log('masterLabs (localStorage):', JSON.parse(localStorage.getItem('masterLabs')));
console.log('masterRads (localStorage):', JSON.parse(localStorage.getItem('masterRads')));
console.log('masterProcedures (localStorage):', JSON.parse(localStorage.getItem('masterProcedures')));
console.log('masterMedications (localStorage):', JSON.parse(localStorage.getItem('masterMedications')));
console.log('Catatan: Firebase data akan terlihat di React Developer Tools (jika installed)');
```

---

## 🔄 Manual Sync ke Firebase (Jika Perlu)

Jika user update master data offline, dan ingin force sinkron ke Firebase:

### Opsi 1: Refresh Page
```
User hanya perlu refresh (F5 atau Ctrl+R)
Sistem akan otomatis load data dari Firebase dan merge dengan localStorage
```

### Opsi 2: Update One Master Item (lebih gentle)
1. Buka menu Setelen
2. Hapus salah satu item master (contoh: "Darah Rutin")
3. Klik Hapus → Sistem akan simpan ke Firebase dan localStorage
4. Tambah kembali item itu → Sistem akan simpan ulang ke Firebase

Ini akan trigger `saveSettings()` yang melakukan dual persistence (lokal + Firebase).

---

## 🐛 Common Issues & Solutions

### Issue 1: "Menggunakan data lokal" terus-terusan
**Gejala**: Status indicator selalu menunjukkan ⚠️  
**Penyebab**: Firebase tidak bisa connect (network error, API key wrong, dll)

**Solusi**:
1. Cek koneksi internet
2. Buka DevTools > Network tab
3. Refresh page, cari request ke `firebaseio.com` atau `googleapis.com`
4. Lihat apakah response-nya error 403, 404, atau timeout
5. Jika Firebase config salah, contact admin untuk update API key di `src/App.jsx` line 27-35

### Issue 2: Data tampil di Setelen, tapi tidak muncul di form Planning
**Gejala**: Master lab/rad/procedure/medication sudah ditambah, tapi saat buat record baru tidak keluar di dropdown

**Penyebab**: `combinedPlanningOptions` tidak update karena dependency array belum include semua master data

**Solusi**:
1. Refresh page (hard refresh: Ctrl+Shift+R di Chrome, Cmd+Shift+R di Mac)
2. Tunggu beberapa detik untuk data load dari Firebase
3. Cek di DevTools console apakah ada error

### Issue 3: localStorage tidak bisa simpan (quota exceeded)
**Gejala**: Saat simpan master data, alert "Gagal menyimpan setelan..."  
**Penyebab**: Browser localStorage penuh (biasanya 5-10MB limit)

**Solusi**:
```javascript
// Di Console, hapus data yang tidak perlu:
localStorage.removeItem('cf_transactions'); // Hapus transaction history lama
localStorage.removeItem('cf_loans');         // Hapus loan history lama
localStorage.clear();                        // Atau clear semua (last resort)
```

### Issue 4: Data master berbeda di 2 device
**Gejala**: User A tambah master di device 1, device 2 tidak ada data baru

**Penyebab**: localStorage adalah per-device. Firebase adalah source of truth, tapi Firebase membutuhkan koneksi internet untuk sinkron

**Solusi**:
1. Pada device yang offline, tambahkan data master (tersimpan lokal)
2. Saat online, refresh page (data akan load dari Firebase dan merge dengan lokal)
3. Device lain yang sudah online pasti akan lihat data terbaru
4. Jika device ke-2 offline saat device 1 update, buka DevTools > Network > Online/Offline untuk simulate koneksi
5. Saat device 2 online lagi, refresh page untuk sinkron

---

## 📈 Performance Tips

### Untuk User dengan Master Data Banyak
Jika sudah ada 500+ items di master lab, refresh akan lebih lambat.

**Solusi**:
1. Bersihkan data master yang sudah tidak pakai
2. Hapus duplikat (contoh: "Darah Rutin" vs "DARAH RUTIN" vs "darah rutin")
3. Group items dengan naming convention (contoh: "Lab: Darah Rutin" vs "Lab: HJL")

### Untuk Hospital dengan Banyak User
Jika 50+ dokter akses app secara bersamaan, Firebase bandwidth bisa throttle.

**Solusi**:
1. Baca dari `masterLabs` (React state) lebih cepat daripada Firebase real-time
2. Setiap user sudah punya copy lokal di localStorage
3. Jika masih lambat, contact Firebase support untuk upgrade

---

## 📞 Debug Info untuk Report Bug

Jika ada bug, share info berikut:

```
1. Browser & Version:
   - Chrome 125, Firefox 123, Safari 17, dll

2. Device:
   - Desktop Windows, Mac, Mobile Android, iPhone, dll

3. Network Condition:
   - Online (good signal)
   - Slow (menggunakan Chrome DevTools throttle: Slow 3G)
   - Offline
   - Merah WiFi (signal < 1 bar)

4. Steps to Reproduce:
   - User lakukan apa yang menghasilkan bug

5. Expected vs Actual:
   - Seharusnya: [apa yang diharap]
   - Sebenarnya: [apa yang terjadi]

6. Console Logs:
   - Buka DevTools > Console
   - Copy-paste error message atau warning

7. localStorage Status:
   - Buka DevTools > Application > localStorage
   - Screenshot atau copy keys yang ada
```

Contoh report yang baik:

```
Bug: Master Lab hilang setelah refresh page

Steps:
1. Offline mode (DevTools > Network > Offline)
2. Buka Setelen
3. Tambah "Lab: COVID-19 Antigen"
4. Tampil di list
5. Refresh page (F5)
6. Lab yang ditambah hilang!

Expected: Data lokal harus restore dari localStorage
Actual: List kosong

Console: (tidak ada error)
localStorage masterLabs: ["Darah Rutin","HJL"] (tidak ada "COVID-19 Antigen")

Browser: Chrome 125 on Windows 11
```

---

## 🔐 Security Note

**localStorage Hanya untuk Backup, Bukan Source of Truth**

- Data real-time tetap dari Firebase
- localStorage bukan encrypt → jangan simpan sensitive data (passwords, tokens, dll)
- Browser history juga tidak simpan localStorage
- Setiap user punya localStorage sendiri (tidak bisa akses data user lain)

**Best Practice:**
1. Master data (lab, radiologi, dll) → aman di localStorage
2. Patient records → hanya di Firebase (sudah have access control)
3. User credentials → hanya di localStorage (tapi ideally, store di server session)

---

## 📖 Referensi Code

### Lokasi Master Data Init
```
src/App.jsx line 2121-2133  → useState initialization dengan localStorage
```

### Lokasi Retry Logic
```
src/App.jsx line 2289-2345  → useEffect untuk load settings dari Firebase
```

### Lokasi Save Logic
```
src/App.jsx line 2329-2344  → saveSettings function (dual persistence)
```

### Lokasi UI Indicator
```
src/App.jsx line 3418-3430  → Status badge di Settings view
```

---

**Last Updated**: 3 Mei 2026  
**Version**: 1.0  
