// config/supabase.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Thiếu thông tin kết nối Supabase trong file .env');
  process.exit(1);
}

// Tạo client thông thường với anon key
const supabase = createClient(supabaseUrl, supabaseKey);
console.log('✅ Supabase client được khởi tạo với anon key');

// Tạo admin client với service role key
const getAdminClient = () => {
  if (!supabaseServiceKey) {
    console.error('❌ Thiếu SUPABASE_SERVICE_ROLE_KEY trong biến môi trường');
    return null;
  }
  
  console.log('✅ Tạo admin client với service role key');
  return createClient(supabaseUrl, supabaseServiceKey);
};

// Lấy thông tin cấu hình Supabase cho client-side
const getSupabaseConfig = () => {
  return {
    supabaseUrl,
    supabaseKey
  };
};

module.exports = { supabase, getAdminClient, getSupabaseConfig };