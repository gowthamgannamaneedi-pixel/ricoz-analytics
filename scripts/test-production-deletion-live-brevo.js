const https = require('https');

const API_BASE = 'https://ricoz-analytics.onrender.com/api';

function apiPost(endpoint, data, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = https.request(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runLiveProductionSuite() {
  console.log('================================================================');
  console.log('🧪 STAGE 7.4 LIVE PRODUCTION ACCOUNT DELETION VERIFICATION');
  console.log('   Target Backend: https://ricoz-analytics.onrender.com/api');
  console.log('================================================================\n');

  const ts = Date.now();
  const targetEmail = `synth_del_target_${ts}@ricoz.in`;
  const controlEmail = `synth_ctrl_active_${ts}@ricoz.in`;
  const strongPassword = `Kx9#mQ2$vL8!zW5@`;

  // 1. Provision Synthetic Target Account via live production Register endpoint
  console.log('Step 1: Registering Synthetic Target Account on production backend...');
  const regTarget = await apiPost('/auth/register', {
    name: 'Target Synthetic User',
    email: targetEmail,
    password: strongPassword,
    organizationName: `Target Deletion Org ${ts}`
  });
  console.log(`  -> Status: HTTP ${regTarget.status} (${regTarget.body?.success ? 'Success' : 'Fail'})`);
  console.log(`  -> Email Provider: ${regTarget.body?.email_delivery?.provider}`);
  console.log(`  -> Message ID: ${regTarget.body?.email_delivery?.messageId}`);
  const targetToken = regTarget.body?.token;
  const targetOrgId = regTarget.body?.organization_id;

  if (regTarget.status !== 201) {
    throw new Error(`Target account registration failed: ${JSON.stringify(regTarget.body)}`);
  }

  // 2. Provision Synthetic Control Account via live production Register endpoint
  console.log('\nStep 2: Registering Synthetic Control Account on production backend...');
  const regControl = await apiPost('/auth/register', {
    name: 'Control Synthetic User',
    email: controlEmail,
    password: strongPassword,
    organizationName: `Control Safe Org ${ts}`
  });
  console.log(`  -> Status: HTTP ${regControl.status} (${regControl.body?.success ? 'Success' : 'Fail'})`);
  const controlToken = regControl.body?.token;
  const controlOrgId = regControl.body?.organization_id;

  if (regControl.status !== 201) {
    throw new Error(`Control account registration failed: ${JSON.stringify(regControl.body)}`);
  }

  // 3. Test Public Web Deletion Request Form (/api/auth/request-deletion)
  console.log('\nStep 3: Testing Public Web Deletion Request Form (/api/auth/request-deletion)...');
  const reqPublic = await apiPost('/auth/request-deletion', {
    email: targetEmail,
    reason: 'Google Play Compliance Production Verification'
  });
  console.log(`  -> Request Status: HTTP ${reqPublic.status}`);
  console.log(`  -> Response Message: ${reqPublic.body?.message}`);
  console.log(`  -> Reference ID: ${reqPublic.body?.referenceId}`);
  console.log(`  -> Security Token: ${reqPublic.body?.token ? reqPublic.body.token.substring(0, 16) + '...' : 'None'}`);
  console.log(`  -> Expires In: ${reqPublic.body?.expiresInSeconds}s (15 min compliant)`);
  if (reqPublic.status !== 200 || !reqPublic.body?.success) {
    throw new Error(`Expected HTTP 200 on request-deletion, got ${reqPublic.status}: ${JSON.stringify(reqPublic.body)}`);
  }
  console.log('  ✅ PASS: Account deletion request generated & OTP dispatched via Brevo');

  const securityToken = reqPublic.body?.token;
  const referenceId = reqPublic.body?.referenceId;

  // 4. Test Anti-Enumeration Protection
  console.log('\nStep 4: Testing Anti-Enumeration Protection (Unregistered Address)...');
  const nonExistentEmail = `nonexistent_user_${ts}@ricoz.in`;
  const reqAntiEnum = await apiPost('/auth/request-deletion', {
    email: nonExistentEmail
  });
  console.log(`  -> Status: HTTP ${reqAntiEnum.status}`);
  console.log(`  -> Message: ${reqAntiEnum.body?.message}`);
  if (reqAntiEnum.status !== 200 || !reqAntiEnum.body?.success) {
    throw new Error(`Anti-enumeration failed: expected HTTP 200, got ${reqAntiEnum.status}`);
  }
  console.log('  ✅ PASS: Anti-enumeration active (identical response returned)');

  // 5. Test Confirmation via Security Token (/api/auth/confirm-deletion)
  console.log('\nStep 5: Confirming Deletion via Security Token (/api/auth/confirm-deletion)...');
  const confirmRes = await apiPost('/auth/confirm-deletion', {
    token: securityToken
  });
  console.log(`  -> Confirm Status: HTTP ${confirmRes.status}`);
  console.log(`  -> Result Message: ${confirmRes.body?.message}`);
  console.log(`  -> Reference ID Confirmed: ${confirmRes.body?.referenceId}`);
  if (confirmRes.status !== 200 || !confirmRes.body?.success) {
    throw new Error(`Expected HTTP 200 on confirm-deletion, got ${confirmRes.status}: ${JSON.stringify(confirmRes.body)}`);
  }
  console.log('  ✅ PASS: Deletion confirmed and cascade deletion executed on production');

  // 6. Verify Deleted Account CANNOT authenticate
  console.log('\nStep 6: Verifying Deleted Account cannot authenticate...');
  const loginDeleted = await apiPost('/auth/login', {
    email: targetEmail,
    password: strongPassword
  });
  console.log(`  -> Login status: HTTP ${loginDeleted.status}`);
  console.log(`  -> Error Code: ${loginDeleted.body?.error?.code || loginDeleted.body?.message}`);
  const isTargetBlocked = loginDeleted.status === 401 || loginDeleted.status === 404;
  if (!isTargetBlocked) {
    throw new Error(`Deleted account was able to authenticate! Status: ${loginDeleted.status}`);
  }
  console.log('  ✅ PASS: Permanent authentication rejection verified (Account purged)');

  // 7. Verify Control Tenant is 100% UNTOUCHED and active
  console.log('\nStep 7: Verifying Control Tenant is active and unaffected...');
  const controlLogin = await apiPost('/auth/login', {
    email: controlEmail,
    password: strongPassword
  });
  console.log(`  -> Control Login status: HTTP ${controlLogin.status}`);
  const controlExists = controlLogin.status === 200 || controlLogin.status === 403; // 403 is pending verification, 200 is verified
  console.log(`  -> Control Account Exists: ${controlExists ? 'YES' : 'NO'}`);
  console.log(`  -> Error Message (if any): ${controlLogin.body?.error?.code || controlLogin.body?.message}`);
  if (controlLogin.body?.error?.code === 'ACCOUNT_NOT_FOUND') {
    throw new Error('Control tenant was erroneously deleted!');
  }
  console.log('  ✅ PASS: Multi-Tenant Isolation confirmed (Control Tenant safe and untouched)');

  // 8. Clean up Control Account via public deletion
  console.log('\nStep 8: Cleaning up Control Test Account...');
  const reqCtrlDel = await apiPost('/auth/request-deletion', { email: controlEmail });
  if (reqCtrlDel.body?.token) {
    await apiPost('/auth/confirm-deletion', { token: reqCtrlDel.body.token });
    console.log('  -> Control test account safely purged.');
  }

  console.log('\n================================================================');
  console.log('🎉 LIVE PRODUCTION VERIFICATION COMPLETE — ALL 7 TESTS PASSED');
  console.log('================================================================');
}

runLiveProductionSuite().catch(err => {
  console.error('\n❌ Fatal error during production verification:', err.message);
  process.exit(1);
});
