import '@expo/metro-runtime';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Platform, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './config';

const TOKEN_KEY = 'giuaky_token';
const EMPTY = { email: '', hoten: '', matkhau: '', hinhanh: '' };

async function saveToken(value) {
  if (Platform.OS === 'web') {
    if (value) window.localStorage.setItem(TOKEN_KEY, value);
    else window.localStorage.removeItem(TOKEN_KEY);
  } else {
    if (value) await SecureStore.setItemAsync(TOKEN_KEY, value);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}
async function readToken() {
  return Platform.OS === 'web'
    ? window.localStorage.getItem(TOKEN_KEY)
    : await SecureStore.getItemAsync(TOKEN_KEY);
}
async function api(path, { method = 'GET', token, body } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  } catch (_) {
    throw new Error(`Khong ket noi duoc API (${API_URL}). Kiem tra backend, IP va Wi-Fi.`);
  }
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; }
  catch (_) { throw new Error(`May chu phan hoi khong hop le (HTTP ${response.status}).`); }
  if (!response.ok) throw new Error(data.error || `Loi HTTP ${response.status}`);
  return data;
}
function notify(message) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert('Thong bao', message);
}
function confirmDelete(name, onYes) {
  if (Platform.OS === 'web') {
    if (window.confirm(`Ban chac chan muon xoa ${name}?`)) onYes();
    return;
  }
  Alert.alert('Xac nhan xoa', `Ban chac chan muon xoa ${name}?`, [
    { text: 'Huy', style: 'cancel' },
    { text: 'Xoa', style: 'destructive', onPress: onYes }
  ]);
}
function Button({ title, onPress, type = 'primary', disabled = false, small = false }) {
  return (
    <TouchableOpacity
      disabled={disabled}
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.button, type === 'outline' && styles.outlineButton,
        type === 'danger' && styles.dangerButton, small && styles.smallButton,
        disabled && { opacity: 0.5 }]}
    >
      <Text style={[styles.buttonText, type === 'outline' && styles.outlineText]}>{title}</Text>
    </TouchableOpacity>
  );
}
function Field({ label, value, onChangeText, secure, keyboardType, placeholder }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor="#94a3b8"
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        autoCorrect={false}
        keyboardType={keyboardType || 'default'}
        secureTextEntry={!!secure}
        style={styles.input}
      />
    </View>
  );
}
function Avatar({ photo, size = 56 }) {
  return photo ? (
    <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: 15 }} />
  ) : (
    <View style={[styles.avatarEmpty, { width: size, height: size, borderRadius: 15 }]}>
      <Text style={{ fontSize: size / 2.8 }}>👤</Text>
    </View>
  );
}
export default function App() {
  const { width } = useWindowDimensions();
  const compact = width < 640;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [page, setPage] = useState('list');
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [error, setError] = useState('');
  const filteredUsers = useMemo(() => users.filter(u =>
    `${u.hoten} ${u.email}`.toLowerCase().includes(search.toLowerCase().trim())
  ), [users, search]);

  const fail = e => setError(e?.message || String(e));
  const update = (key, value) => setForm(old => ({ ...old, [key]: value }));
  const list = async (t = token) => {
    const records = await api('/users', { token: t });
    setUsers(records);
  };
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await readToken();
        if (saved) {
          try {
            const me = await api('/auth/me', { token: saved });
            const records = await api('/users', { token: saved });
            if (active) { setToken(saved); setProfile(me); setUsers(records); }
            return;
          } catch (_) { await saveToken(null); }
        }
        const status = await api('/auth/setup-status');
        if (active) setNeedsSetup(status.needsSetup);
      } catch (e) { if (active) fail(e); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  async function signedOut() {
    await saveToken(null);
    setToken(null); setProfile(null); setUsers([]); setPage('list'); setError('');
    try { setNeedsSetup((await api('/auth/setup-status')).needsSetup); }
    catch (e) { fail(e); }
  }
  async function authenticate(setup = false) {
    setError(''); setBusy(true);
    try {
      let credentials;
      if (setup) {
        credentials = await api('/auth/setup', { method: 'POST', body: form });
      } else {
        credentials = await api('/auth/login', {
          method: 'POST', body: { email: loginEmail, matkhau: loginPass }
        });
      }
      await saveToken(credentials.token);
      setToken(credentials.token); setProfile(credentials.user); setNeedsSetup(false);
      setForm(EMPTY); setLoginPass(''); setPage('list');
      await list(credentials.token);
    } catch (e) { fail(e); }
    finally { setBusy(false); }
  }
  function startAdd() { setEditId(null); setForm(EMPTY); setError(''); setPage('form'); }
  function startEdit(user) {
    setEditId(user._id);
    setForm({ email: user.email, hoten: user.hoten, matkhau: '', hinhanh: user.hinhanh || '' });
    setError(''); setPage('form');
  }
  async function pickImage() {
    // Phai chon tu su kien nhan nut; Safari tren iPhone khong cho phep chon tu dong.
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) { notify('Hay cap quyen truy cap Thu vien anh.'); return; }
      }
      const selected = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], quality: 0.35, allowsEditing: false, base64: true
      });
      if (selected.canceled) return;
      const asset = selected.assets?.[0];
      if (!asset?.base64) throw new Error('Khong doc duoc anh. Thu chon anh JPG/PNG khac.');
      const mime = ['image/png', 'image/webp'].includes(asset.mimeType) ? asset.mimeType : 'image/jpeg';
      const photo = `data:${mime};base64,${asset.base64}`;
      if (photo.length > 4_500_000) throw new Error('Anh qua lon. Hay chon anh nho hon.');
      update('hinhanh', photo);
      setError('');
    } catch (e) { fail(e); }
  }
  async function saveUser() {
    setError(''); setBusy(true);
    try {
      if (!form.email.trim() || !form.hoten.trim() || (!editId && !form.matkhau)) {
        throw new Error('Nhap day du email, ho ten va mat khau khi them moi.');
      }
      const payload = { email: form.email.trim(), hoten: form.hoten.trim(), hinhanh: form.hinhanh };
      if (form.matkhau) payload.matkhau = form.matkhau;
      const updated = await api(editId ? `/users/${editId}` : '/users', {
        method: editId ? 'PUT' : 'POST', token, body: payload
      });
      if (updated._id === profile?._id) setProfile(updated);
      await list(); setForm(EMPTY); setEditId(null); setPage('list');
    } catch (e) { fail(e); }
    finally { setBusy(false); }
  }
  function removeUser(user) {
    confirmDelete(user.hoten, async () => {
      setError(''); setBusy(true);
      try {
        await api(`/users/${user._id}`, { method: 'DELETE', token });
        if (user._id === profile?._id) await signedOut();
        else await list();
      } catch (e) { fail(e); }
      finally { setBusy(false); }
    });
  }

  if (loading) return <SafeAreaView style={styles.root}><View style={styles.center}><ActivityIndicator size="large" color="#2563eb"/><Text style={styles.muted}>Dang ket noi...</Text></View></SafeAreaView>;
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.shell}>
          <View style={styles.brand}>
            <View style={styles.brandIcon}><Text style={{ fontSize: 25 }}>👥</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, compact && { fontSize: 22 }]}>Quản lý người dùng</Text>
              <Text style={styles.subtitle}>Bài giữa kỳ • Expo + Node.js + MongoDB</Text>
            </View>
          </View>
          {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
          {!token ? (
            <View style={[styles.card, styles.authCard]}>
              <Text style={styles.heading}>{needsSetup ? 'Tạo tài khoản đầu tiên' : 'Đăng nhập quản trị'}</Text>
              <Text style={styles.muted}>{needsSetup
                ? 'Database chưa có người dùng. Tạo tài khoản đầu tiên để bắt đầu.'
                : 'Đăng nhập bằng tài khoản đã được thêm vào MongoDB.'}</Text>
              {needsSetup ? (
                <>
                  <Field label="Họ tên" value={form.hoten} onChangeText={v => update('hoten', v)}/>
                  <Field label="Email" value={form.email} onChangeText={v => update('email', v)} keyboardType="email-address"/>
                  <Field label="Mật khẩu (từ 6 ký tự)" value={form.matkhau} onChangeText={v => update('matkhau', v)} secure/>
                  <View style={styles.photoRow}>
                    <Avatar photo={form.hinhanh} size={74}/>
                    <Button type="outline" small title="Chọn ảnh" onPress={pickImage}/>
                  </View>
                  <Button disabled={busy} title={busy ? 'Đang tạo...' : 'Tạo tài khoản và vào ứng dụng'} onPress={() => authenticate(true)}/>
                </>
              ) : (
                <>
                  <Field label="Email" value={loginEmail} onChangeText={setLoginEmail} keyboardType="email-address"/>
                  <Field label="Mật khẩu" value={loginPass} onChangeText={setLoginPass} secure/>
                  <Button disabled={busy} title={busy ? 'Đang đăng nhập...' : 'Đăng nhập'} onPress={() => authenticate(false)}/>
                </>
              )}
              <Text style={[styles.muted, { marginTop: 13, fontSize: 12 }]}>API: {API_URL}</Text>
            </View>
          ) : (
            <>
              <View style={[styles.toolbar, compact && { alignItems: 'flex-start' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hello}>Xin chào, {profile?.hoten}</Text>
                  <Text style={styles.muted}>Phân hệ quản lý người dùng</Text>
                </View>
                <Button small type="outline" title="Đăng xuất" onPress={signedOut}/>
              </View>
              <View style={styles.tabs}>
                <Button small title="Danh sách" type={page === 'list' ? 'primary' : 'outline'} onPress={async () => {
                  setPage('list'); setError(''); try { await list(); } catch (e) { fail(e); }
                }}/>
                <Button small title="+ Thêm người dùng" type={page === 'form' && !editId ? 'primary' : 'outline'} onPress={startAdd}/>
              </View>
              {busy && <ActivityIndicator size="small" color="#2563eb" style={{ marginBottom: 14 }}/>} 
              {page === 'form' ? (
                <View style={styles.card}>
                  <Text style={styles.heading}>{editId ? 'Chỉnh sửa người dùng' : 'Thêm người dùng'}</Text>
                  <Field label="Họ tên" value={form.hoten} onChangeText={v => update('hoten', v)}/>
                  <Field label="Email" value={form.email} onChangeText={v => update('email', v)} keyboardType="email-address"/>
                  <Field label={editId ? 'Mật khẩu mới (để trống nếu giữ nguyên)' : 'Mật khẩu (từ 6 ký tự)'} value={form.matkhau} onChangeText={v => update('matkhau', v)} secure/>
                  <Text style={styles.label}>Hình ảnh</Text>
                  <View style={styles.photoRow}>
                    <Avatar photo={form.hinhanh} size={98}/>
                    <View style={{ gap: 7 }}>
                      <Button small type="outline" title="Chọn ảnh trên thiết bị" onPress={pickImage}/>
                      {!!form.hinhanh && <Button small type="outline" title="Bỏ ảnh" onPress={() => update('hinhanh', '')}/>} 
                    </View>
                  </View>
                  <View style={styles.buttonRow}>
                    <Button disabled={busy} title={editId ? 'Lưu thay đổi' : 'Thêm người dùng'} onPress={saveUser}/>
                    <Button type="outline" title="Hủy" onPress={() => { setError(''); setPage('list'); }}/>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.statRow}>
                    <View><Text style={styles.heading}>Danh sách người dùng</Text><Text style={styles.muted}>{users.length} tài khoản trong MongoDB</Text></View>
                    <Button small type="outline" title="↻ Tải lại" onPress={async () => { try { await list(); setError(''); } catch (e) { fail(e); } }}/>
                  </View>
                  <TextInput
                    style={[styles.input, { marginBottom: 14 }]}
                    value={search} onChangeText={setSearch}
                    placeholder="Tìm theo họ tên hoặc email..."
                    placeholderTextColor="#94a3b8"
                  />
                  {filteredUsers.length === 0 && <View style={styles.card}><Text style={styles.muted}>Không có người dùng phù hợp.</Text></View>}
                  {filteredUsers.map(user => (
                    <View key={user._id} style={[styles.card, styles.userCard]}>
                      <Avatar photo={user.hinhanh}/>
                      <View style={styles.userText}>
                        <Text style={styles.userName}>{user.hoten}</Text>
                        <Text style={styles.userEmail}>{user.email}</Text>
                        <Text style={styles.tiny}>Mật khẩu: •••••••• (đã mã hóa)</Text>
                      </View>
                      <View style={[styles.rowActions, compact && { flexDirection: 'column' }]}>
                        <Button small type="outline" title="Sửa" onPress={() => startEdit(user)}/>
                        <Button small type="danger" title="Xóa" onPress={() => removeUser(user)}/>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
          <Text style={styles.footer}>CSDL: email • matkhau • hoten • hinhanh (MongoDB tự sinh _id)</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f6fd' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  scroll: { flexGrow: 1, paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 32 : 18, paddingBottom: 45 },
  shell: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  brandIcon: { width: 58, height: 58, borderRadius: 17, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 27, fontWeight: '800', color: '#14213d' },
  subtitle: { color: '#64748b', fontSize: 13, marginTop: 5 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e3eaf4', borderRadius: 18, padding: 20, marginBottom: 12 },
  authCard: { width: '100%', maxWidth: 470, alignSelf: 'center', padding: 24 },
  heading: { fontSize: 20, fontWeight: '750', color: '#172033', marginBottom: 7 },
  muted: { color: '#64748b', fontSize: 14 },
  hello: { fontSize: 18, fontWeight: '750', color: '#1e293b' },
  toolbar: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 14 },
  tabs: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 17 },
  field: { marginTop: 15, marginBottom: 4 },
  label: { fontWeight: '650', color: '#334155', marginBottom: 8, fontSize: 14 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 11, backgroundColor: '#fff', paddingHorizontal: 13, paddingVertical: 12, minHeight: 47, fontSize: 15, color: '#0f172a' },
  button: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', minHeight: 44 },
  smallButton: { minHeight: 38, paddingVertical: 8, paddingHorizontal: 13 },
  buttonText: { fontWeight: '700', fontSize: 14, color: '#fff', textAlign: 'center' },
  outlineButton: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1 },
  outlineText: { color: '#1d4ed8' },
  dangerButton: { backgroundColor: '#dc2626' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 14 },
  avatarEmpty: { backgroundColor: '#e8eef7', alignItems: 'center', justifyContent: 'center' },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 15 },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 },
  userText: { flex: 1, minWidth: 90 },
  userName: { color: '#172033', fontSize: 16, fontWeight: '750' },
  userEmail: { color: '#475569', fontSize: 13, marginTop: 4 },
  tiny: { color: '#94a3b8', fontSize: 11, marginTop: 5 },
  rowActions: { flexDirection: 'row', gap: 6 },
  errorBox: { padding: 14, borderRadius: 12, backgroundColor: '#fee2e2', marginBottom: 14, borderWidth: 1, borderColor: '#fecaca' },
  errorText: { color: '#991b1b', fontWeight: '550' },
  footer: { textAlign: 'center', color: '#94a3b8', fontSize: 11, marginTop: 24 }
});
