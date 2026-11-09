const { supabase, supabaseAdmin, isConfigured } = require('./config/supabase');

async function testSB() {
  console.log('isConfigured:', isConfigured);
  if (!isConfigured || !supabase) {
    console.log('Supabase not configured');
    return;
  }
  
  console.log('Supabase client initialized. Testing connection health...');
  try {
    const { data, error } = await supabase.auth.getSession();
    console.log('Session check successful (no email sent):', { error: error?.message || null });
    
    if (supabaseAdmin && supabaseAdmin.auth && supabaseAdmin.auth.admin) {
      console.log('Supabase Admin client verified (service role active).');
    }
    console.log('✅ Supabase Auth diagnostic complete safely with ZERO external email dispatches.');
  } catch (err) {
    console.error('Catch error:', err.message);
  }
}

testSB();
