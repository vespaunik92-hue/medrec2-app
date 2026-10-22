import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}
const db = admin.firestore();
const auth = admin.auth();
const FV = admin.firestore.FieldValue;

const GOD_EMAIL = 'abi@simpan.local';
const MANAGERS = ['karu', 'admin', 'admin_ruangan'];
const WARD_ROLES = ['member', 'Pelaksana', 'karu', 'admin', 'admin_ruangan', 'PPJA', 'finance_kas', 'finance_doc', 'finance_jm'];

const norm = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
const normId = (s) => String(s || '').toLowerCase().trim().replace(/\s+/g, '_');
const toAuthPw = (pw) => (pw.length >= 6 ? pw : pw + '_simpan');
const emailOf = (id) => `${id}@simpan.local`;
const inScope = (c, t) =>
  norm(c.ward) === norm(t.ward) &&
  (!c.hospital || !t.hospital || norm(c.hospital) === norm(t.hospital));

class HttpError extends Error {
  constructor(code, msg) { super(msg); this.code = code; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metode tidak diizinkan' });
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) throw new HttpError(401, 'Belum login');
    let decoded;
    try { decoded = await auth.verifyIdToken(token); }
    catch { throw new HttpError(401, 'Sesi tidak valid, silakan login ulang'); }

    const callerId = String(decoded.email || '').split('@')[0];
    const callerSnap = await db.collection('users').doc(callerId).get();
    if (!callerSnap.exists) throw new HttpError(403, 'Akun tidak terdaftar');
    const caller = callerSnap.data();
    const isGod = decoded.email === GOD_EMAIL;
    if (!isGod && (caller.status === 'pending' || !MANAGERS.includes(caller.role) || !caller.ward))
      throw new HttpError(403, 'Tidak punya hak mengelola pengguna');

    const body = req.body || {};
    const action = body.action;
    const targetId = normId(body.id);
    if (!/^[a-z0-9._-]{2,40}$/.test(targetId)) throw new HttpError(400, 'Username tidak valid');

    const targetRef = db.collection('users').doc(targetId);
    const targetSnap = await targetRef.get();
    const target = targetSnap.exists ? targetSnap.data() : null;

    const assertScope = () => {
      if (isGod) return;
      if (!target || !inScope(caller, target))
        throw new HttpError(403, 'Hanya bisa mengelola pengguna di ruangan Anda sendiri');
    };
    const assertRole = (role) => {
      if (!isGod && !WARD_ROLES.includes(role)) throw new HttpError(403, 'Role tidak diizinkan');
    };

    if (action === 'create') {
      const name = String(body.name || '').trim();
      const pass = String(body.pass || '');
      const role = body.role || 'member';
      if (!name) throw new HttpError(400, 'Nama wajib diisi');
      if (pass.length < 8) throw new HttpError(400, 'Password minimal 8 karakter');
      if (target) throw new HttpError(409, 'Username sudah dipakai');
      assertRole(role);
      const ward = isGod ? norm(body.ward) : norm(caller.ward);
      const hospital = isGod ? norm(body.hospital || caller.hospital) : norm(caller.hospital);
      if (!ward) throw new HttpError(400, 'Ruangan wajib diisi');

      let created;
      try {
        created = await auth.createUser({ email: emailOf(targetId), password: toAuthPw(pass), displayName: name });
      } catch (e) {
        if (e.code === 'auth/email-already-exists') throw new HttpError(409, 'Username sudah dipakai (akun login sudah ada)');
        throw e;
      }
      try {
        await targetRef.set({
          id: targetId, name, role, ward,
          ...(hospital ? { hospital } : {}),
          status: 'approved',
          createdAt: admin.firestore.Timestamp.now(),
        });
      } catch (e) {
        await auth.deleteUser(created.uid).catch(() => {});
        throw e;
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'update') {
      if (!target) throw new HttpError(404, 'Pengguna tidak ditemukan');
      assertScope();
      const patch = {};
      if (body.name) patch.name = String(body.name).trim();
      if (body.role) {
        if (!isGod && targetId === callerId) throw new HttpError(403, 'Tidak bisa mengubah role sendiri');
        assertRole(body.role);
        patch.role = body.role;
      }
      if (isGod) {
        if (body.ward) patch.ward = norm(body.ward);
        if (body.hospital) patch.hospital = norm(body.hospital);
      }
      if (Object.keys(patch).length) await targetRef.update(patch);
      return res.status(200).json({ ok: true });
    }

    if (action === 'resetPassword') {
      if (!target) throw new HttpError(404, 'Pengguna tidak ditemukan');
      assertScope();
      const pass = String(body.pass || '');
      if (pass.length < 8) throw new HttpError(400, 'Password minimal 8 karakter');
      try {
        const u = await auth.getUserByEmail(emailOf(targetId));
        await auth.updateUser(u.uid, { password: toAuthPw(pass) });
        await auth.revokeRefreshTokens(u.uid);
      } catch (e) {
        if (e.code === 'auth/user-not-found') await auth.createUser({ email: emailOf(targetId), password: toAuthPw(pass) });
        else throw e;
      }
      await targetRef.update({ pass: FV.delete() });
      return res.status(200).json({ ok: true });
    }

    if (action === 'approve') {
      if (!target) throw new HttpError(404, 'Pengguna tidak ditemukan');
      assertScope();
      if (target.status !== 'pending') throw new HttpError(400, 'Akun tidak berstatus pending');
      assertRole(target.role);
      await targetRef.update({ status: 'approved' });
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete') {
      if (targetId === callerId) throw new HttpError(400, 'Tidak bisa menghapus diri sendiri');
      if (!target) throw new HttpError(404, 'Pengguna tidak ditemukan');
      assertScope();
      try {
        const u = await auth.getUserByEmail(emailOf(targetId));
        await auth.deleteUser(u.uid);
      } catch (e) {
        if (e.code !== 'auth/user-not-found') throw e;
      }
      await targetRef.delete();
      return res.status(200).json({ ok: true });
    }

    throw new HttpError(400, 'Aksi tidak dikenal');
  } catch (e) {
    const code = e instanceof HttpError ? e.code : 500;
    if (code === 500) console.error(e);
    return res.status(code).json({ error: code === 500 ? 'Kesalahan server: ' + e.message : e.message });
  }
}