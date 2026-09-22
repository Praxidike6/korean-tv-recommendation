// Supabase Auth identifies the user; database RLS enforces editor access.
let canEdit = false;
let authRevision = 0;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function requireEditor() {
  if (canEdit) return true;
  alert('Sign in with an approved editor account to make changes.');
  return false;
}

async function updateAccess(session) {
  const revision = ++authRevision;
  canEdit = false;
  closeModal();
  document.getElementById('addShowButton').hidden = true;
  document.getElementById('signInForm').hidden = Boolean(session);
  document.getElementById('signOutButton').hidden = !session;
  const status = document.getElementById('authStatus');
  status.textContent = session ? 'Checking editor access…' : 'Public watchlist · Sign in to edit';
  renderApp();
  if (!session) return;
  try {
    const {data, error} = await supabaseClient.from('watchlist_editors')
      .select('user_id').eq('user_id', session.user.id).maybeSingle();
    if (revision !== authRevision) return;
    canEdit = !error && Boolean(data);
    status.textContent = error
      ? 'Unable to check editor access. Browsing remains available; try signing in again.'
      : canEdit ? `Signed in as ${session.user.email} · Editor`
        : `Signed in as ${session.user.email} · View only. Ask the owner for editor access.`;
  } catch {
    if (revision !== authRevision) return;
    status.textContent = 'Unable to check editor access. Please try again.';
  }
  document.getElementById('addShowButton').hidden = !canEdit;
  renderApp();
}

async function signIn(event) {
  event.preventDefault();
  const button = document.getElementById('signInButton');
  const status = document.getElementById('authStatus');
  button.disabled = true;
  status.textContent = 'Sending sign-in link…';
  try {
    const {error} = await supabaseClient.auth.signInWithOtp({
      email: document.getElementById('signInEmail').value.trim(),
      options: {shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname}
    });
    status.textContent = error
      ? 'Could not send a link. Check your invitation and email address, or try again later.'
      : 'Check your email for a sign-in link. Only invited accounts can sign in.';
  } catch {
    status.textContent = 'Could not reach the sign-in service. Please try again.';
  } finally {
    button.disabled = false;
  }
}

async function signOut() {
  await updateAccess(null);
  const {error} = await supabaseClient.auth.signOut({scope: 'local'});
  if (error) document.getElementById('authStatus').textContent = 'Sign-out failed. Please reload and try again.';
}

async function initializeAuth() {
  // Do not await other Supabase calls inside an auth callback (SDK lock).
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => updateAccess(session), 0);
  });
  const revision = authRevision;
  const {data, error} = await supabaseClient.auth.getSession();
  if (revision === authRevision) await updateAccess(error ? null : data.session);
}
