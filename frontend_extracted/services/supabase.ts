
import { createClient } from '@supabase/supabase-js';

// Project: nvrcsheavwwrcukhtvcw
const SUPABASE_URL = 'https://nvrcsheavwwrcukhtvcw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52cmNzaGVhdnd3cmN1a2h0dmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MzkyMDUsImV4cCI6MjA4NjMxNTIwNX0.0ndDO1K8c_WnP3FQumSCoWf-XGlBsrBfJXlCNMplGSE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
