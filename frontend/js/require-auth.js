(() => {
  const token = localStorage.getItem('ss_token');
  const target = location.pathname.split('/').pop() + location.search + location.hash;
  const signIn = () => location.replace('login.html?next=' + encodeURIComponent(target));
  if (!token) { signIn(); return; }

  document.documentElement.classList.add('auth-checking');
  fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
    .then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.user) throw new Error('Your session has expired. Please sign in again.');
      localStorage.setItem('ss_user', JSON.stringify(data.user));
      document.documentElement.classList.remove('auth-checking');
    })
    .catch(error => {
      localStorage.removeItem('ss_token');
      localStorage.removeItem('ss_user');
      signIn();
    });
})();
