import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qzgxqhcxggzcadbzniih.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6Z3hxaGN4Z2d6Y2FkYnpuaWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2OTAzMDcsImV4cCI6MjEwNDI2NjMwN30.LExu4mLiBbI5qz8sjY7Hqb9jZTx_i5-CxSMczQGyBfI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
