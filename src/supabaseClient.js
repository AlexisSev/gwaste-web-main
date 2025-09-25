import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://xrcqdqnmmblnfzssgixm.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyY3FkcW5tbWJsbmZ6c3NnaXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjQ2NzgsImV4cCI6MjA3MzUwMDY3OH0.FCRjqh5d3ox4QvXgYnmC4UYvMO2427WElbO1GR9H2Vs";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


