(() => {
  const page = location.pathname.split('/').pop();
  if (!['login.html', 'register.html', 'admin-login.html'].includes(page)) return;
  const url = new URL(location.href);
  let changed = false;
  for (const key of ['name', 'email', 'password']) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) history.replaceState(history.state, '', url.pathname + url.search + url.hash);
})();
