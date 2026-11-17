import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    console.warn(`[env] Missing ${name} — set it in .env for full functionality`);
    return '';
  }
  return value;
}

export const env = {
  port: Number(process.env.API_PORT || 3001),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  supabaseUrl: required('SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  supabaseAnonKey: required('SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  cloudinaryCloudName: required('CLOUDINARY_CLOUD_NAME'),
  cloudinaryApiKey: required('CLOUDINARY_API_KEY'),
  cloudinaryApiSecret: required('CLOUDINARY_API_SECRET'),
  usdaFdcApiKey: process.env.USDA_FDC_API_KEY || '',
};
