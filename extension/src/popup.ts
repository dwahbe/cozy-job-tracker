const API_BASE = 'https://cozyjobtracker.com';

// --- State management ---

type AppState =
  'loading' | 'signed-out' | 'ready' | 'adding' | 'preview' | 'saving' | 'success' | 'error';

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

interface BoardColumn {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown' | 'date';
  options?: string[];
}

let pendingJob: ValidatedJob | null = null;
let boardColumns: BoardColumn[] = [];
let initialDueDateInput = '';

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

function setInputValue(id: string, value: string) {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
  if (el) el.value = value;
}

function customFieldId(index: number): string {
  return `preview-custom-${index}`;
}

function renderCustomFields(columns: BoardColumn[]) {
  const card = document.querySelector('#state-preview .preview-card');
  const verifiedRow = document.getElementById('preview-verified-row');
  if (!card || !verifiedRow) return;

  card.querySelectorAll('.preview-custom-row').forEach((el) => el.remove());

  for (const [index, col] of columns.entries()) {
    const row = document.createElement('div');
    row.className = 'preview-row preview-custom-row';

    const label = document.createElement('label');
    label.className = 'preview-label';
    label.textContent = col.name;
    const id = customFieldId(index);
    label.htmlFor = id;
    row.appendChild(label);

    let input: HTMLElement;
    if (col.type === 'dropdown') {
      const select = document.createElement('select');
      select.className = 'preview-input';
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = '—';
      select.appendChild(empty);
      for (const opt of col.options ?? []) {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
      }
      input = select;
    } else if (col.type === 'checkbox') {
      const wrapper = document.createElement('label');
      wrapper.className = 'preview-checkbox-wrapper';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'preview-checkbox';
      checkbox.id = id;
      const text = document.createElement('span');
      text.textContent = 'Yes';
      wrapper.append(checkbox, text);
      row.appendChild(wrapper);
      card.insertBefore(row, verifiedRow);
      continue;
    } else if (col.type === 'date') {
      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.className = 'preview-input';
      input = dateInput;
    } else {
      const textArea = document.createElement('textarea');
      textArea.className = 'preview-input preview-textarea';
      textArea.rows = 1;
      input = textArea;
    }

    input.id = id;
    row.appendChild(input);
    card.insertBefore(row, verifiedRow);
  }
}

function showPreview(job: ValidatedJob, fetchWarning?: string) {
  pendingJob = job;

  setInputValue('preview-title', job.title ?? '');
  setInputValue('preview-company', job.company ?? '');
  setInputValue('preview-location', job.location ?? '');
  setInputValue('preview-type', job.employment_type ?? '');
  setInputValue('preview-notes', job.notes ?? '');

  // Date input only accepts YYYY-MM-DD; "rolling" or other strings won't parse, leave blank
  const dueDateValue = job.due_date && /^\d{4}-\d{2}-\d{2}$/.test(job.due_date) ? job.due_date : '';
  setInputValue('preview-due-date', dueDateValue);
  initialDueDateInput = dueDateValue;

  renderCustomFields(boardColumns);

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

function getInputValue(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
  return el?.value.trim() ?? '';
}

function collectCustomFields(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [index, col] of boardColumns.entries()) {
    const id = customFieldId(index);
    if (col.type === 'checkbox') {
      const cb = document.getElementById(id) as HTMLInputElement | null;
      result[col.name] = cb?.checked ? 'Yes' : 'No';
    } else {
      const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
      const v = el?.value ?? '';
      if (v) result[col.name] = v;
    }
  }
  return result;
}

async function loadBoardColumns(token: string): Promise<void> {
  try {
    const data = await apiGet<{ columns?: BoardColumn[] }>('/api/extension/board', token);
    boardColumns = Array.isArray(data.columns) ? data.columns : [];
  } catch {
    boardColumns = [];
  }
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
    const [data] = await Promise.all([
      apiPost<{
        job?: ValidatedJob;
        fetchWarning?: string;
        error?: string;
      }>('/api/extension/parse-job', token, { url }),
      loadBoardColumns(token),
    ]);

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

  const dueDateInput = getInputValue('preview-due-date');
  // If the user didn't touch the date input, preserve the parsed value — this keeps
  // non-representable values like "rolling" that the date input can't display.
  const dueDate = dueDateInput === initialDueDateInput ? (pendingJob.due_date ?? '') : dueDateInput;

  const overrides = {
    title: getInputValue('preview-title'),
    company: getInputValue('preview-company'),
    location: getInputValue('preview-location'),
    employmentType: getInputValue('preview-type'),
    dueDate,
    notes: (document.getElementById('preview-notes') as HTMLTextAreaElement | null)?.value ?? '',
  };
  const customFields = collectCustomFields();

  try {
    const data = await apiPost<{
      success?: boolean;
      title?: string;
      company?: string;
      error?: string;
    }>('/api/extension/add-job', token, { job: pendingJob, overrides, customFields });

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

document.getElementById('btn-close')?.addEventListener('click', () => {
  window.close();
});

document.getElementById('link-board')?.addEventListener('click', (e) => {
  e.preventDefault();
  const href = (e.currentTarget as HTMLAnchorElement).href;
  chrome.tabs.create({ url: href });
});

init();
