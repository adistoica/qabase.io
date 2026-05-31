import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hwaitbjeoemtbleoinqc.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3YWl0Ymplb2VtdGJsZW9pbnFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4ODg4NTgsImV4cCI6MjA5NTQ2NDg1OH0.j3tX1VmKXw0g73iaWUobUsn9eWSReRpD_qoME399Eak';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
