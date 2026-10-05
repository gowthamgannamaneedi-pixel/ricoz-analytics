const { supabase, isConfigured } = require('./config/supabase');

async function testSB() {
  console.log('isConfigured:', isConfigured);
  if (!isConfigured || !supabase) {
    console.log('Supabase not configured');
    return;
  }
  
  const testEmail = `test_otp_${Date.now()}@gmail.com`;
  console.log('Testing signUp with:', testEmail);
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: 'StrongPassword123!',
      options: {
        data: {
          name: 'Test OTP User',
          role: 'viewer'
        }
      }
    });
    console.log('SignUp error:', error ? error.message : null);
    console.log('SignUp data user ID:', data?.user?.id, 'confirmed_at:', data?.user?.confirmed_at, 'identities:', data?.user?.identities?.length);
    
    console.log('Testing invalid verifyOtp...');
    const { data: vData, error: vErr } = await supabase.auth.verifyOtp({
      email: testEmail,
      token: '123456',
      type: 'signup'
    });
    console.log('VerifyOtp invalid token result:', { user: vData?.user?.id, error: vErr?.message, status: vErr?.status });

    console.log('Testing resend...');
    const { data: rData, error: rErr } = await supabase.auth.resend({
      type: 'signup',
      email: testEmail
    });
    console.log('Resend result:', { data: rData, error: rErr?.message });
  } catch (err) {
    console.error('Catch error:', err.message);
  }
}

testSB();
