// Thin wrapper over fetch. Every call carries the signed-in demo user in the X-User header,
// and every error comes back as { status, message, fieldErrors } from the Spring Boot API.

const USER_KEY = 'revaluation.user';

export function storedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function storeUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* private mode: the user just signs in again next time */
  }
}

export class ApiError extends Error {
  constructor(status, message, fieldErrors = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const user = storedUser();
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(user ? { 'X-User': user.username } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check that the backend is running.');
  }
  const text = await res.text();
  const data = text && (text.startsWith('{') || text.startsWith('[')) ? JSON.parse(text) : text;
  if (!res.ok) {
    throw new ApiError(res.status, data?.message || `Request failed (${res.status})`, data?.fieldErrors || {});
  }
  return data;
}

export const rupees = (paise) => `₹${(Number(paise || 0) / 100).toLocaleString('en-IN')}`;

export const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
