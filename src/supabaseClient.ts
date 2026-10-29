import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xddgnksgljktfqtiivbv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkZGdua3NnbGprdGZxdGlpdmJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyNTgyMzYsImV4cCI6MjEwODgzNDIzNn0.6cYrhJa63NPkucR-ALbR1hXTOi2r_pyQcBE5EYMxcNU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);