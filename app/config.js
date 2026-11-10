import { Platform } from 'react-native';

// Expo Go tren iPhone: can EXPO_PUBLIC_API_URL=http://IP-LAPTOP:3000 trong app/.env
// Web: neu khong thiet lap .env, tu lay hostname cua laptop / trinh duyet.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'web' && typeof window !== 'undefined'
    ? `http://${window.location.hostname}:3000`
    : 'http://192.168.1.10:3000')).replace(/\/$/, '');
