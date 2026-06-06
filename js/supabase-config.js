// Configuração do Supabase
const SUPABASE_URL = "https://boonxzjismeebxidrdhs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb254emppc21lZWJ4aWRyZGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NDY1MDgsImV4cCI6MjA5NjIyMjUwOH0.jDMtgCTcgxpJn6fkxjxc8k4rGyM7k-3zvwExfoV1t7w";

// Inicializa o cliente global do Supabase (A biblioteca CDN expõe 'supabase')
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Exportação/Disponibilização global para os outros scripts
window.supabaseClient = _supabase;
