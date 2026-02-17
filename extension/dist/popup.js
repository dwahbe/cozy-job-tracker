function z(q) {
  (document.querySelectorAll('.state').forEach((j) => j.classList.add('hidden')),
    document.getElementById(`state-${q}`)?.classList.remove('hidden'));
}
async function I() {
  let q = await chrome.cookies.get({
    url: 'https://cozyjobtracker.com',
    name: '__Secure-authjs.session-token',
  });
  if (q?.value) return q.value;
  return (
    (await chrome.cookies.get({ url: 'https://cozyjobtracker.com', name: 'authjs.session-token' }))
      ?.value ?? null
  );
}
async function O(q, j) {
  return (
    await fetch(`https://cozyjobtracker.com${q}`, { headers: { Authorization: `Bearer ${j}` } })
  ).json();
}
async function Q(q, j, x) {
  return (
    await fetch(`https://cozyjobtracker.com${q}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${j}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(x),
    })
  ).json();
}
async function N() {
  let [q] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
  return q?.url ?? null;
}
async function M(q) {
  try {
    let j = await O('/api/extension/me', q);
    if ('error' in j && j.error) return (await chrome.storage.session.remove('user'), null);
    return (await chrome.storage.session.set({ user: j }), j);
  } catch {
    return null;
  }
}
async function H(q) {
  let j = document.getElementById('user-email');
  if (j) j.textContent = q.email;
  let x = await N(),
    A = document.getElementById('current-url');
  if (A) A.textContent = x || 'No URL detected';
  let F = document.getElementById('btn-add');
  if (F) {
    let D = x && (x.startsWith('http://') || x.startsWith('https://'));
    if (((F.disabled = !D), !D && A)) A.textContent = "This page can't be parsed (not a web page)";
  }
  z('ready');
}
async function W() {
  z('loading');
  let q = await I();
  if (!q) {
    z('signed-out');
    return;
  }
  let j = await chrome.storage.session.get('user');
  if (j.user) {
    (await H(j.user), M(q));
    return;
  }
  let x = await M(q);
  if (!x) {
    z('signed-out');
    return;
  }
  await H(x);
}
document.getElementById('btn-sign-in')?.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://cozyjobtracker.com/login' });
});
document.getElementById('btn-sign-out')?.addEventListener('click', async () => {
  (await chrome.storage.session.remove('user'), z('signed-out'));
});
document.getElementById('btn-add')?.addEventListener('click', async () => {
  z('adding');
  let q = await I();
  if (!q) {
    z('signed-out');
    return;
  }
  let j = await N();
  if (!j) {
    let x = document.getElementById('error-message');
    if (x) x.textContent = "Couldn't get the current page URL.";
    z('error');
    return;
  }
  try {
    let x = await Q('/api/extension/add-job', q, { url: j });
    if (x.error) {
      let K = document.getElementById('error-message');
      if (K) K.textContent = x.error;
      z('error');
      return;
    }
    let A = document.getElementById('success-title');
    if (A) A.textContent = x.title || 'Job added';
    let F = document.getElementById('success-company');
    if (F) F.textContent = x.company ? `at ${x.company}` : '';
    let D = document.getElementById('success-warning');
    if (D)
      if (x.warning) ((D.textContent = x.warning), D.classList.remove('hidden'));
      else D.classList.add('hidden');
    let J = document.getElementById('link-board');
    if (J) J.href = 'https://cozyjobtracker.com/board';
    z('success');
  } catch {
    let x = document.getElementById('error-message');
    if (x) x.textContent = 'Something went wrong. Please try again.';
    z('error');
  }
});
document.getElementById('btn-retry')?.addEventListener('click', async () => {
  if (!(await I())) {
    z('signed-out');
    return;
  }
  let j = await chrome.storage.session.get('user');
  if (j.user) await H(j.user);
  else z('signed-out');
});
document.getElementById('btn-add-another')?.addEventListener('click', async () => {
  if (!(await I())) {
    z('signed-out');
    return;
  }
  let j = await chrome.storage.session.get('user');
  if (j.user) await H(j.user);
  else z('signed-out');
});
document.getElementById('link-board')?.addEventListener('click', (q) => {
  q.preventDefault();
  let j = q.currentTarget.href;
  chrome.tabs.create({ url: j });
});
W();
