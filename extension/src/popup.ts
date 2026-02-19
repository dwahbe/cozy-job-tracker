const API_BASE = 'https://cozyjobtracker.com';

// --- State management ---

type AppState = 'loading' | 'signed-out' | 'ready' | 'adding' | 'preview' | 'saving' | 'success' | 'error';

interface ValidatedJob {
  title: string | null;
  company: string | null;
  location: string | null;
  employment_type: string | null;
  due_date: string | null;
  notes: string | null;
  isVerified: boolean;
  fetchedAt: string;
  finalUrl: string;
}

let pendingJob: ValidatedJob | null = null;

function showState(state: AppState) {
  document.querySelectorAll('.state').forEach((el) => el.classList.add('hidden'));
  document.getElementById(`state-${state}`)?.classList.remove('hidden');
}

// --- Cookie helpers ---

async function getSessionToken(): Promise<string | null> {
  const secureCookie = await chrome.cookies.get({
    url: API_BASE,
    name: '__Secure-authjs.session-token',
  });
  if (secureCookie?.value) return secureCookie.value;

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

  pendingJob = null;
  showState('ready');
}

function setPreviewField(id: string, value: string | null, rowId?: string) {
  const el = document.getElementById(id);
  if (!el) return;

  if (value) {
    el.textContent = value;
    el.className = 'preview-value';
    if (rowId) document.getElementById(rowId)?.classList.remove('hidden');
  } else {
    el.textContent = 'Not found';
    el.className = 'preview-value not-found';
  }
}

function showPreview(job: ValidatedJob, fetchWarning?: string) {
  pendingJob = job;

  setPreviewField('preview-title', job.title);
  setPreviewField('preview-company', job.company);
  setPreviewField('preview-location', job.location);
  setPreviewField('preview-type', job.employment_type);

  if (job.due_date) {
    const dueDateEl = document.getElementById('preview-due-date');
    if (dueDateEl) {
      dueDateEl.textContent = job.due_date === 'rolling' ? 'Rolling basis' : job.due_date;
      dueDateEl.className = 'preview-value';
    }
    document.getElementById('preview-due-date-row')?.classList.remove('hidden');
  } else {
    document.getElementById('preview-due-date-row')?.classList.add('hidden');
  }

  if (job.notes) {
    const notesEl = document.getElementById('preview-notes');
    if (notesEl) {
      notesEl.textContent = job.notes;
      notesEl.className = 'preview-value';
    }
    document.getElementById('preview-notes-row')?.classList.remove('hidden');
  } else {
    document.getElementById('preview-notes-row')?.classList.add('hidden');
  }

  const verifiedEl = document.getElementById('preview-verified');
  if (verifiedEl) {
    verifiedEl.textContent = job.isVerified ? 'Yes' : 'Partial';
    verifiedEl.className = `preview-value ${job.isVerified ? 'verified-yes' : 'verified-partial'}`;
  }

  const warningEl = document.getElementById('preview-warning');
  if (warningEl) {
    if (fetchWarning) {
      warningEl.textContent = fetchWarning;
      warningEl.classList.remove('hidden');
    } else {
      warningEl.classList.add('hidden');
    }
  }

  showState('preview');
}

// --- Main init ---

async function init() {
  showState('loading');

  const token = await getSessionToken();
  if (!token) {
    showState('signed-out');
    return;
  }

  const cached = await chrome.storage.session.get('user');
  if (cached.user) {
    await showReady(cached.user as UserInfo);
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

// Step 1: Parse the job (no save)
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
      job?: ValidatedJob;
      fetchWarning?: string;
      error?: string;
    }>('/api/extension/parse-job', token, { url });

    if (data.error || !data.job) {
      const errEl = document.getElementById('error-message');
      if (errEl) errEl.textContent = data.error || 'Failed to parse job posting.';
      showState('error');
      return;
    }

    showPreview(data.job, data.fetchWarning);
  } catch {
    const errEl = document.getElementById('error-message');
    if (errEl) errEl.textContent = 'Something went wrong. Please try again.';
    showState('error');
  }
});

// Step 2a: Confirm — save the parsed job
document.getElementById('btn-confirm')?.addEventListener('click', async () => {
  if (!pendingJob) return;
  showState('saving');

  const token = await getSessionToken();
  if (!token) {
    showState('signed-out');
    return;
  }

  try {
    const data = await apiPost<{
      success?: boolean;
      title?: string;
      company?: string;
      error?: string;
    }>('/api/extension/add-job', token, { job: pendingJob });

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

    const boardLink = document.getElementById('link-board') as HTMLAnchorElement | null;
    if (boardLink) boardLink.href = `${API_BASE}/board`;

    pendingJob = null;
    showState('success');
  } catch {
    const errEl = document.getElementById('error-message');
    if (errEl) errEl.textContent = 'Something went wrong. Please try again.';
    showState('error');
  }
});

// Step 2b: Discard — go back to ready
document.getElementById('btn-discard')?.addEventListener('click', async () => {
  pendingJob = null;
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

init();
