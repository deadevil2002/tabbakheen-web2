import { Router, type IRouter } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const router: IRouter = Router();
const WORKSPACE_ROOT = '/home/runner/workspace';

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const m = url.trim().match(/github\.com[/:]([^/]+)\/([^/.\s]+?)(?:\.git)?$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

router.get('/git-push', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(PAGE_HTML);
});

router.post('/git/validate', async (req, res) => {
  const { repoUrl, username, token, branch, pushTarget } = req.body as Record<string, string>;
  const parsed = parseGitHubUrl(repoUrl ?? '');
  if (!parsed) {
    return void res.json({ success: false, error: 'Invalid GitHub repository URL' });
  }
  const { owner, repo } = parsed;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Tabbakheen-GitPush/1.0',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const results: Record<string, { ok: boolean; message: string; detail?: string }> = {};

  try {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (r.ok) {
      const d = (await r.json()) as { full_name: string; private: boolean; default_branch: string };
      results.repoAccess = { ok: true, message: `Repository found: ${d.full_name}`, detail: d.private ? 'Private' : 'Public' };
    } else if (r.status === 401 || r.status === 403) {
      results.repoAccess = { ok: false, message: 'Authentication failed', detail: 'Check token permissions (needs repo scope)' };
    } else if (r.status === 404) {
      results.repoAccess = { ok: false, message: 'Repository not found', detail: 'Check URL and access rights' };
    } else {
      results.repoAccess = { ok: false, message: `GitHub API error ${r.status}` };
    }
  } catch (e: unknown) {
    results.repoAccess = { ok: false, message: `Network error: ${(e as Error).message}` };
  }

  if (token) {
    try {
      const r = await fetch('https://api.github.com/user', { headers });
      if (r.ok) {
        const u = (await r.json()) as { login: string; name?: string };
        results.authCheck = { ok: true, message: `Authenticated as @${u.login}`, detail: u.name ?? undefined };
      } else {
        results.authCheck = { ok: false, message: 'Token is invalid or expired' };
      }
    } catch (e: unknown) {
      results.authCheck = { ok: false, message: `Auth check failed: ${(e as Error).message}` };
    }
  } else {
    results.authCheck = { ok: false, message: 'No token provided', detail: 'Push will likely be rejected by GitHub' };
  }

  if (results.repoAccess.ok && branch) {
    try {
      const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}`, { headers });
      if (r.status === 404) {
        results.branchCheck = {
          ok: pushTarget !== 'existing',
          message: `Branch "${branch}" does not exist yet`,
          detail: pushTarget === 'existing' ? 'You selected Existing Branch — switch to New Branch' : 'Will be created on push',
        };
      } else if (r.ok) {
        results.branchCheck = {
          ok: pushTarget === 'existing',
          message: `Branch "${branch}" already exists`,
          detail: pushTarget === 'new' ? 'Switch target to Existing Branch, or choose a different name' : 'Push will update this branch',
        };
      } else {
        results.branchCheck = { ok: false, message: `Branch check error: ${r.status}` };
      }
    } catch (e: unknown) {
      results.branchCheck = { ok: false, message: `Branch check failed: ${(e as Error).message}` };
    }
  } else if (!branch) {
    results.branchCheck = { ok: false, message: 'Branch name is required' };
  }

  const allOk = Object.values(results).every((r) => r.ok);
  return void res.json({ success: true, owner, repo, results, allOk });
});

router.post('/git/push', async (req, res) => {
  const { repoUrl, username, token, branch, confirmNoMain, confirmNoForce, confirmNoOverwrite } = req.body as Record<string, string>;

  if (!confirmNoMain || !confirmNoForce || !confirmNoOverwrite) {
    return void res.json({ success: false, error: 'All three safety confirmations are required' });
  }
  if (!branch || branch.toLowerCase() === 'main' || branch.toLowerCase() === 'master') {
    return void res.json({ success: false, error: 'Branch name cannot be "main" or "master"' });
  }

  const parsed = parseGitHubUrl(repoUrl ?? '');
  if (!parsed) {
    return void res.json({ success: false, error: 'Invalid GitHub repository URL' });
  }
  const { owner, repo } = parsed;
  const credUrl = token
    ? `https://${encodeURIComponent(username ?? '')}:${encodeURIComponent(token)}@github.com/${owner}/${repo}.git`
    : `https://github.com/${owner}/${repo}.git`;

  try {
    const { stdout, stderr } = await execFileAsync('git', ['push', credUrl, `main:${branch}`], {
      cwd: WORKSPACE_ROOT,
      timeout: 90_000,
    });
    return void res.json({ success: true, stdout, stderr: stderr ?? '', branch, repo: `${owner}/${repo}` });
  } catch (e: unknown) {
    const err = e as { message?: string; stderr?: string; stdout?: string };
    const redact = (s: string) => (token ? s.replaceAll(token, '***') : s);
    return void res.json({
      success: false,
      error: redact(err.message ?? 'Unknown error'),
      stderr: redact(err.stderr ?? ''),
      stdout: redact(err.stdout ?? ''),
    });
  }
});

const PAGE_HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>GitHub Push Setup — Tabbakheen</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:32px 16px}
  h1{font-size:22px;font-weight:700;color:#f8fafc;margin-bottom:4px;display:flex;align-items:center;gap:10px}
  .subtitle{color:#94a3b8;font-size:13px;margin-bottom:28px}
  .card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;width:100%;max-width:620px;margin-bottom:20px}
  .section-title{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:16px;display:flex;align-items:center;gap:8px}
  .section-title span{background:#334155;color:#94a3b8;border-radius:100px;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0}
  label{display:block;font-size:13px;font-weight:500;color:#cbd5e1;margin-bottom:6px}
  .required{color:#f87171;margin-left:2px}
  input[type=text],input[type=password],input[type=url]{width:100%;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:10px 12px;font-size:14px;color:#f1f5f9;outline:none;transition:border .15s}
  input[type=text]:focus,input[type=password]:focus,input[type=url]:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.15)}
  .hint{font-size:11px;color:#64748b;margin-top:4px}
  .field{margin-bottom:16px}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .radio-group{display:flex;gap:8px;flex-wrap:wrap}
  .radio-option{display:flex;align-items:center;gap:8px;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:10px 14px;cursor:pointer;flex:1;min-width:140px;transition:border .15s}
  .radio-option:has(input:checked){border-color:#3b82f6;background:#1e3a5f}
  .radio-option input{accent-color:#3b82f6}
  .radio-option label{color:#e2e8f0;cursor:pointer;margin:0;font-size:13px}
  .checkbox-group{display:flex;flex-direction:column;gap:10px}
  .checkbox-row{display:flex;align-items:flex-start;gap:10px;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px}
  .checkbox-row:has(input:checked){border-color:#22c55e;background:#052e16}
  .checkbox-row input{accent-color:#22c55e;margin-top:2px;flex-shrink:0}
  .checkbox-row label{color:#e2e8f0;font-size:13px;margin:0;cursor:pointer}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:8px;padding:11px 20px;font-size:14px;font-weight:600;cursor:pointer;transition:all .15s;width:100%}
  .btn-blue{background:#3b82f6;color:#fff}.btn-blue:hover:not(:disabled){background:#2563eb}
  .btn-green{background:#16a34a;color:#fff}.btn-green:hover:not(:disabled){background:#15803d}
  .btn:disabled{opacity:.5;cursor:not-allowed}
  .btn-sm{padding:8px 14px;font-size:13px;width:auto}
  .validation-card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;width:100%;max-width:620px;margin-bottom:20px;display:none}
  .check-row{display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid #1e3a5f}
  .check-row:last-child{border-bottom:none}
  .check-icon{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;font-weight:700;margin-top:1px}
  .check-icon.ok{background:#052e16;color:#4ade80}
  .check-icon.fail{background:#2d0a0a;color:#f87171}
  .check-icon.spin{background:#1e3a5f;color:#60a5fa;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .check-label{font-size:13px;font-weight:600;color:#e2e8f0}
  .check-detail{font-size:12px;color:#94a3b8;margin-top:2px}
  .summary-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1e3a5f;font-size:13px}
  .summary-row:last-child{border-bottom:none}
  .summary-key{color:#94a3b8}
  .summary-val{color:#e2e8f0;font-weight:500;text-align:right;max-width:300px;word-break:break-all}
  .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:100px;font-size:11px;font-weight:600}
  .badge-green{background:#052e16;color:#4ade80}
  .badge-blue{background:#1e3a5f;color:#60a5fa}
  .badge-red{background:#2d0a0a;color:#f87171}
  .result-box{padding:16px;border-radius:8px;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-all;display:none}
  .result-success{background:#052e16;border:1px solid #166534;color:#4ade80}
  .result-error{background:#2d0a0a;border:1px solid #991b1b;color:#f87171}
  .git-icon{font-size:22px}
  .spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite}
  #preflight-section{display:none}
  #push-section{display:none}
</style>
</head>
<body>

<h1><span class="git-icon">🔀</span> GitHub Push Setup</h1>
<p class="subtitle">Tabbakheen Food Market · Pre-release branch push tool</p>

<!-- FORM CARD -->
<div class="card">
  <div class="section-title"><span>1</span> Repository &amp; Branch</div>

  <div class="field">
    <label for="repoUrl">GitHub Repository URL <span class="required">*</span></label>
    <input type="url" id="repoUrl" placeholder="https://github.com/deadevil2002/tabbakheen-web2" value="https://github.com/deadevil2002/tabbakheen-web2"/>
    <div class="hint">Full HTTPS URL of the target GitHub repository</div>
  </div>

  <div class="row">
    <div class="field">
      <label for="branchName">Branch Name <span class="required">*</span></label>
      <input type="text" id="branchName" placeholder="pre-release-android-ios-v100" value="pre-release-android-ios-v100"/>
    </div>
    <div class="field">
      <label for="remoteName">Remote Name <span class="required">*</span></label>
      <input type="text" id="remoteName" placeholder="github" value="github"/>
    </div>
  </div>

  <div class="field">
    <label>Push Target <span class="required">*</span></label>
    <div class="radio-group">
      <div class="radio-option">
        <input type="radio" name="pushTarget" id="targetNew" value="new" checked/>
        <label for="targetNew">🌱 New Branch</label>
      </div>
      <div class="radio-option">
        <input type="radio" name="pushTarget" id="targetExisting" value="existing"/>
        <label for="targetExisting">🔄 Existing Branch</label>
      </div>
    </div>
    <div class="hint">Choose "New Branch" if the branch doesn't exist yet on GitHub</div>
  </div>

  <div class="field">
    <label>Create Remote Automatically <span class="required">*</span></label>
    <div class="radio-group">
      <div class="radio-option">
        <input type="radio" name="createRemote" id="remoteYes" value="yes" checked/>
        <label for="remoteYes">✅ Yes — via direct URL push</label>
      </div>
      <div class="radio-option">
        <input type="radio" name="createRemote" id="remoteNo" value="no"/>
        <label for="remoteNo">⛔ No — manual only</label>
      </div>
    </div>
    <div class="hint">Direct URL push avoids modifying .git/config; no <code>git remote add</code> needed</div>
  </div>
</div>

<div class="card">
  <div class="section-title"><span>2</span> Authentication</div>

  <div class="field">
    <label for="username">GitHub Username <span class="required">*</span></label>
    <input type="text" id="username" placeholder="deadevil2002" value="deadevil2002"/>
  </div>

  <div class="field">
    <label for="token">Personal Access Token <span style="color:#64748b;font-size:11px;font-weight:400">(optional — required for private repos or auth)</span></label>
    <input type="password" id="token" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" autocomplete="new-password"/>
    <div class="hint">Token needs <code>repo</code> scope. It is only sent to your own server and to GitHub — never stored.</div>
  </div>
</div>

<div class="card">
  <div class="section-title"><span>3</span> Safety Confirmations</div>
  <div class="checkbox-group">
    <div class="checkbox-row">
      <input type="checkbox" id="confirmNoMain"/>
      <label for="confirmNoMain">I confirm this push is <strong>NOT targeting the main branch</strong>. The branch name above is used as the push target.</label>
    </div>
    <div class="checkbox-row">
      <input type="checkbox" id="confirmNoForce"/>
      <label for="confirmNoForce">I confirm <strong>NO force push</strong> will be used. This is a clean push only.</label>
    </div>
    <div class="checkbox-row">
      <input type="checkbox" id="confirmNoOverwrite"/>
      <label for="confirmNoOverwrite">I confirm <strong>existing branches will NOT be overwritten</strong> without explicit selection of "Existing Branch" above.</label>
    </div>
  </div>
</div>

<div style="width:100%;max-width:620px;margin-bottom:20px">
  <button class="btn btn-blue" id="runPreflightBtn" onclick="runPreflight()">
    🔍 Run Pre-flight Check
  </button>
</div>

<!-- VALIDATION RESULTS -->
<div class="validation-card" id="validationCard">
  <div class="section-title"><span>4</span> Pre-flight Check Results</div>
  <div id="checkRows"></div>
</div>

<!-- PRE-FLIGHT SUMMARY -->
<div class="card" id="preflight-section">
  <div class="section-title"><span>5</span> Push Summary</div>
  <div id="summaryRows"></div>
</div>

<!-- FINAL PUSH -->
<div class="card" id="push-section">
  <div class="section-title"><span>6</span> Final Approval</div>
  <p style="color:#94a3b8;font-size:13px;margin-bottom:16px">
    All checks passed. Review the summary above, then press <strong style="color:#f1f5f9">Push to GitHub</strong> to proceed.
    The push cannot be undone from this tool.
  </p>
  <button class="btn btn-green" id="pushBtn" onclick="performPush()">
    🚀 Push to GitHub
  </button>
</div>

<!-- RESULT -->
<div class="result-box result-success" id="resultSuccess"></div>
<div class="result-box result-error" id="resultError"></div>

<script>
const $ = id => document.getElementById(id);

function val(id) { return $(id)?.value?.trim() ?? ''; }
function checked(id) { return $(id)?.checked ?? false; }
function radioVal(name) { return document.querySelector('input[name="'+name+'"]:checked')?.value ?? ''; }

function validate() {
  const errors = [];
  if (!val('repoUrl')) errors.push('Repository URL is required');
  if (!val('branchName')) errors.push('Branch Name is required');
  if (!val('remoteName')) errors.push('Remote Name is required');
  if (!val('username')) errors.push('GitHub Username is required');
  if (!checked('confirmNoMain')) errors.push('Confirm: no push to main');
  if (!checked('confirmNoForce')) errors.push('Confirm: no force push');
  if (!checked('confirmNoOverwrite')) errors.push('Confirm: no overwrite');
  return errors;
}

async function runPreflight() {
  const errors = validate();
  if (errors.length) { alert('Please fix:\\n• ' + errors.join('\\n• ')); return; }

  const btn = $('runPreflightBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Checking…';

  $('validationCard').style.display = 'block';
  $('checkRows').innerHTML = checkRow('spin', 'Checking repository access…', '') +
    checkRow('spin', 'Checking authentication…', '') +
    checkRow('spin', 'Checking branch availability…', '');
  $('preflight-section').style.display = 'none';
  $('push-section').style.display = 'none';
  $('resultSuccess').style.display = 'none';
  $('resultError').style.display = 'none';

  try {
    const resp = await fetch('/api/git/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repoUrl: val('repoUrl'),
        username: val('username'),
        token: val('token'),
        branch: val('branchName'),
        pushTarget: radioVal('pushTarget'),
      })
    });
    const data = await resp.json();

    if (!data.success) {
      $('checkRows').innerHTML = checkRow('fail', data.error, '');
      btn.disabled = false;
      btn.innerHTML = '🔍 Run Pre-flight Check';
      return;
    }

    const r = data.results;
    let rows = '';
    if (r.repoAccess) rows += checkRow(r.repoAccess.ok ? 'ok' : 'fail', 'Repository Access: ' + r.repoAccess.message, r.repoAccess.detail ?? '');
    if (r.authCheck) rows += checkRow(r.authCheck.ok ? 'ok' : 'fail', 'Authentication: ' + r.authCheck.message, r.authCheck.detail ?? '');
    if (r.branchCheck) rows += checkRow(r.branchCheck.ok ? 'ok' : 'fail', 'Branch Availability: ' + r.branchCheck.message, r.branchCheck.detail ?? '');
    $('checkRows').innerHTML = rows;

    if (data.allOk) {
      showSummary(data);
      $('preflight-section').style.display = 'block';
      $('push-section').style.display = 'block';
    }
  } catch (e) {
    $('checkRows').innerHTML = checkRow('fail', 'Network error: ' + e.message, 'Make sure the API server is running');
  }

  btn.disabled = false;
  btn.innerHTML = '🔍 Run Pre-flight Check';
}

function showSummary(data) {
  const branch = val('branchName');
  const target = radioVal('pushTarget') === 'new' ? 'New Branch (will be created)' : 'Existing Branch (will be updated)';
  const remote = radioVal('createRemote') === 'yes' ? 'Direct URL push (no .git/config change)' : 'Manual';
  const rows = [
    ['Repository', data.owner + '/' + data.repo],
    ['Branch', branch],
    ['Push Target', target],
    ['Remote Strategy', remote],
    ['Remote Name', val('remoteName')],
    ['Source Branch', 'main (current HEAD)'],
    ['Force Push', '<span class="badge badge-green">DISABLED</span>'],
    ['Main Branch', '<span class="badge badge-green">UNTOUCHED</span>'],
    ['Auth User', data.results.authCheck?.message?.replace('Authenticated as ', '') ?? val('username')],
  ];
  $('summaryRows').innerHTML = rows.map(([k,v]) =>
    '<div class="summary-row"><span class="summary-key">' + k + '</span><span class="summary-val">' + v + '</span></div>'
  ).join('');
}

async function performPush() {
  const btn = $('pushBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Pushing…';
  $('resultSuccess').style.display = 'none';
  $('resultError').style.display = 'none';

  try {
    const resp = await fetch('/api/git/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repoUrl: val('repoUrl'),
        username: val('username'),
        token: val('token'),
        branch: val('branchName'),
        confirmNoMain: checked('confirmNoMain') ? 'yes' : '',
        confirmNoForce: checked('confirmNoForce') ? 'yes' : '',
        confirmNoOverwrite: checked('confirmNoOverwrite') ? 'yes' : '',
      })
    });
    const data = await resp.json();

    if (data.success) {
      $('resultSuccess').style.display = 'block';
      $('resultSuccess').textContent =
        '✅ Push successful!\\n\\n' +
        'Repository: ' + data.repo + '\\n' +
        'Branch:     ' + data.branch + '\\n\\n' +
        (data.stdout ? 'Output:\\n' + data.stdout : '') +
        (data.stderr ? '\\nInfo:\\n' + data.stderr : '');
      $('push-section').style.display = 'none';
    } else {
      $('resultError').style.display = 'block';
      $('resultError').textContent =
        '❌ Push failed\\n\\n' +
        'Error: ' + data.error + '\\n' +
        (data.stderr ? '\\nDetails:\\n' + data.stderr : '');
      btn.disabled = false;
      btn.innerHTML = '🚀 Push to GitHub';
    }
  } catch (e) {
    $('resultError').style.display = 'block';
    $('resultError').textContent = '❌ Network error: ' + e.message;
    btn.disabled = false;
    btn.innerHTML = '🚀 Push to GitHub';
  }
}

function checkRow(status, label, detail) {
  const icon = status === 'ok' ? '✓' : status === 'fail' ? '✗' : '↻';
  return '<div class="check-row">' +
    '<div class="check-icon ' + status + '">' + icon + '</div>' +
    '<div><div class="check-label">' + label + '</div>' +
    (detail ? '<div class="check-detail">' + detail + '</div>' : '') +
    '</div></div>';
}
</script>
</body>
</html>`;

export default router;
