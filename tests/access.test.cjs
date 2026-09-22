const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

function fixture() {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {
      value: '', checked: false, hidden: false, textContent: '', innerHTML: '',
      style: {}, classList: {add() {}, remove() {}}, reset() {}
    });
    return elements.get(id);
  };
  const calls = [];
  const client = {
    auth: {
      signInWithOtp: async (args) => { calls.push(args); return {error: null}; },
      signOut: async () => ({error: null})
    },
    from: () => { throw new Error('Unexpected database access'); }
  };
  const context = vm.createContext({
    document: {getElementById: element}, window: {ENV: {}},
    supabase: {createClient: () => client}, alert: (s) => calls.push(s),
    confirm: () => true, console, setTimeout,
    location: {origin: 'https://example.com', pathname: '/watchlist/'}
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'auth.js'), 'utf8'), context);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  let script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  script = script.slice(0, script.lastIndexOf('      fetchShows();'));
  vm.runInContext(script, context);
  return {context, client, calls, element, run: (s) => vm.runInContext(s, context)};
}

test('public users cannot invoke any write handlers', async () => {
  const f = fixture();
  await f.run('toggleField("Example", "watched", true)');
  await f.run('deleteShow("Example")');
  await f.run('handleFormSubmit({preventDefault(){}})');
  f.run('openModal(); openEditModal({name:"Example"})');
  assert.equal(f.calls.length, 5);
});

test('show text and inline handler arguments are safely escaped', () => {
  const f = fixture();
  const card = f.run('renderShowCard({name: "<img src=x onerror=alert(1)>O\'Brien", genre: "Drama"})');
  assert.ok(card.includes('&lt;img'));
  assert.ok(card.includes('&#39;'));
  assert.ok(!card.includes('<img src=x'));
  assert.ok(card.includes('disabled'));
  assert.ok(card.includes('<div hidden'));
});

test('only a confirmed membership enables editing', async () => {
  const f = fixture();
  f.client.from = () => ({select: () => ({eq: () => ({maybeSingle: async () => ({data: {user_id: 'u'}, error: null})})})});
  await f.run('updateAccess({user:{id:"u",email:"editor@example.com"}})');
  assert.equal(f.run('canEdit'), true);
  assert.equal(f.element('addShowButton').hidden, false);
  await f.run('updateAccess(null)');
  assert.equal(f.run('canEdit'), false);
  assert.equal(f.element('addShowButton').hidden, true);
});

test('missing membership and membership errors fail closed', async () => {
  const f = fixture();
  for (const response of [{data:null,error:null}, {data:null,error:{message:'denied'}}]) {
    f.client.from = () => ({select: () => ({eq: () => ({maybeSingle: async () => response})})});
    await f.run('updateAccess({user:{id:"u",email:"viewer@example.com"}})');
    assert.equal(f.run('canEdit'), false);
  }
});

test('late membership response cannot restore editing after sign-out', async () => {
  const f = fixture();
  let resolve;
  f.client.from = () => ({select: () => ({eq: () => ({maybeSingle: () => new Promise(r => {resolve = r;})})})});
  const pending = f.run('updateAccess({user:{id:"u",email:"editor@example.com"}})');
  await f.run('updateAccess(null)');
  resolve({data:{user_id:'u'},error:null});
  await pending;
  assert.equal(f.run('canEdit'), false);
});

test('email sign-in never registers new accounts and uses the app path', async () => {
  const f = fixture();
  f.element('signInEmail').value = ' invited@example.com ';
  await f.run('signIn({preventDefault(){}})');
  assert.equal(f.calls[0].options.shouldCreateUser, false);
  assert.equal(f.calls[0].options.emailRedirectTo, 'https://example.com/watchlist/');
  assert.equal(f.calls[0].email, 'invited@example.com');
});

test('zero-row updates are not reported as successful', async () => {
  const f = fixture();
  f.run('canEdit = true; fetchShows = () => {}; allShows = [{name:"Example",watched:false}]');
  f.client.from = () => ({update: () => ({eq: () => ({select: async () => ({data:[],error:null})})})});
  await f.run('toggleField("Example", "watched", true)');
  assert.match(f.calls[0], /editing access removed/);
  assert.equal(f.run('allShows[0].watched'), false);
});
