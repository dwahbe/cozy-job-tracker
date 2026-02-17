const API_BASE = 'https://cozyjobtracker.com';

// --- State management ---

type AppState = 'loading' | 'signed-out' | 'ready' | 'adding' | 'success' | 'error';

function showState(state: AppState) {
  document.querySelectorAll('.state').forEach((el) => el.classList.add('hidden'));
  document.getElementById(`state-${state}`)?.classList.remove('hidden');
}

// --- Cookie helpers ---

async function getSessionToken(): Promise<string | null> {
  // Try secure cookie first (production HTTPS)
  const secureCookie = await chrome.cookies.get({
    url: API_BASE,
    name: '__Secure-authjs.session-token',
  });
  if (secureCookie?.value) return secureCookie.value;

  // Fall back to non-secure cookie (local dev)
  const cookie = await chrome.cookies.get({
    url: API_BASE,
    name: 'authjs.session-token',
  });
  return cookie?.value ?? null;
}

// --- API helpers ---

async function apiGet<T = Record<string, unknown>>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<T>;
}

async function apiPost<T = Record<string, unknown>>(
  path: string,
  token: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<T>;
}

// --- Tab helpers ---

async function getCurrentTabUrl(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ?? null;
}

// --- Auth ---

interface UserInfo {
  email: string;
  name: string | null;
}

async function validateToken(token: string): Promise<UserInfo | null> {
  try {
    const data = await apiGet<UserInfo & { error?: string }>('/api/extension/me', token);
    if ('error' in data && data.error) {
      await chrome.storage.session.remove('user');
      return null;
    }
    await chrome.storage.session.set({ user: data });
    return data;
  } catch {
    return null;
  }
}

// --- UI updates ---

async function showReady(user: UserInfo) {
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = user.email;

  const url = await getCurrentTabUrl();
  const urlEl = document.getElementById('current-url');
  if (urlEl) urlEl.textContent = url || 'No URL detected';

  const addBtn = document.getElementById('btn-add') as HTMLButtonElement | null;
  if (addBtn) {
    const isValid = url && (url.startsWith('http://') || url.startsWith('https://'));
    addBtn.disabled = !isValid;
    if (!isValid && urlEl) {
      urlEl.textContent = "This page can't be parsed (not a web page)";
    }
  }

  showState('ready');
}

// --- Main init ---

async function init() {
  showState('loading');

  const token = await getSessionToken();
  if (!token) {
    showState('signed-out');
    return;
  }

  // Check cache first for faster popup open
  const cached = await chrome.storage.session.get('user');
  if (cached.user) {
    await showReady(cached.user as UserInfo);
    // Re-validate in background (don't await)
    validateToken(token);
    return;
  }

  const user = await validateToken(token);
  if (!user) {
    showState('signed-out');
    return;
  }

  await showReady(user);
}

// --- Event listeners ---

document.getElementById('btn-sign-in')?.addEventListener('click', () => {
  chrome.tabs.create({ url: `${API_BASE}/login` });
});

document.getElementById('btn-sign-out')?.addEventListener('click', async () => {
  await chrome.storage.session.remove('user');
  showState('signed-out');
});

document.getElementById('btn-add')?.addEventListener('click', async () => {
  showState('adding');

  const token = await getSessionToken();
  if (!token) {
    showState('signed-out');
    return;
  }

  const url = await getCurrentTabUrl();
  if (!url) {
    const errEl = document.getElementById('error-message');
    if (errEl) errEl.textContent = "Couldn't get the current page URL.";
    showState('error');
    return;
  }

  try {
    const data = await apiPost<{
      success?: boolean;
      title?: string;
      company?: string;
      warning?: string;
      error?: string;
    }>('/api/extension/add-job', token, { url });

    if (data.error) {
      const errEl = document.getElementById('error-message');
      if (errEl) errEl.textContent = data.error;
      showState('error');
      return;
    }

    const titleEl = document.getElementById('success-title');
    if (titleEl) titleEl.textContent = data.title || 'Job added';

    const companyEl = document.getElementById('success-company');
    if (companyEl) companyEl.textContent = data.company ? `at ${data.company}` : '';

    const warningEl = document.getElementById('success-warning');
    if (warningEl) {
      if (data.warning) {
        warningEl.textContent = data.warning;
        warningEl.classList.remove('hidden');
      } else {
        warningEl.classList.add('hidden');
      }
    }

    const boardLink = document.getElementById('link-board') as HTMLAnchorElement | null;
    if (boardLink) boardLink.href = `${API_BASE}/board`;

    showState('success');
  } catch {
    const errEl = document.getElementById('error-message');
    if (errEl) errEl.textContent = 'Something went wrong. Please try again.';
    showState('error');
  }
});

document.getElementById('btn-retry')?.addEventListener('click', async () => {
  const token = await getSessionToken();
  if (!token) {
    showState('signed-out');
    return;
  }
  const cached = await chrome.storage.session.get('user');
  if (cached.user) {
    await showReady(cached.user as UserInfo);
  } else {
    showState('signed-out');
  }
});

document.getElementById('btn-add-another')?.addEventListener('click', async () => {
  const token = await getSessionToken();
  if (!token) {
    showState('signed-out');
    return;
  }
  const cached = await chrome.storage.session.get('user');
  if (cached.user) {
    await showReady(cached.user as UserInfo);
  } else {
    showState('signed-out');
  }
});

document.getElementById('link-board')?.addEventListener('click', (e) => {
  e.preventDefault();
  const href = (e.currentTarget as HTMLAnchorElement).href;
  chrome.tabs.create({ url: href });
});

// Go
init();
