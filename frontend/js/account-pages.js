(() => {
  const token = localStorage.getItem('ss_token');
  const current = (() => { try { return JSON.parse(localStorage.getItem('ss_user') || 'null'); } catch { return null; } })();
  if (!token || !current) { location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop()); return; }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials = name => String(name || '?').trim().split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase() || '?';
  const setAvatar = (element, account) => { if (!element) return; element.innerHTML = account.avatar ? `<img src="${esc(account.avatar)}" alt="${esc(account.name)} profile photo">` : `<span>${esc(initials(account.name))}</span>`; };
  const setMessage = (el, text, error = false) => { if (el) { el.textContent = text; el.classList.toggle('error-text', error); } };
  const request = async (url, options = {}) => {
    const response = await fetch('/api' + url, { ...options, headers: { Authorization: 'Bearer ' + token, ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Could not complete the request.');
    return data;
  };
  let account = current;
  const updateLocal = next => { account = next; localStorage.setItem('ss_user', JSON.stringify(next)); };
  const renderAccount = () => {
    setAvatar(document.getElementById('profileAvatar'), account); setAvatar(document.getElementById('settingsAvatar'), account);
    const name = document.getElementById('profileName'); if (name) name.textContent = account.name || '—';
    const email = document.getElementById('profileEmail'); if (email) email.textContent = account.email || '—';
    const detail = document.getElementById('profileEmailDetail'); if (detail) detail.textContent = account.email || '—';
    const role = document.getElementById('profileRole'); if (role) role.textContent = account.role === 'admin' ? 'Administrator' : 'Member';
    const since = document.getElementById('profileSince'); if (since) since.textContent = account.createdAt ? new Date(account.createdAt).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}) : '—';
    const settingsName = document.getElementById('settingsName'); if (settingsName) settingsName.textContent = account.name || '—';
    const settingsEmail = document.getElementById('settingsEmail'); if (settingsEmail) settingsEmail.textContent = account.email || '—';
    const nameInput = document.getElementById('editProfileName'); if (nameInput) nameInput.value = account.name || '';
    const emailInput = document.getElementById('editProfileEmail'); if (emailInput) emailInput.value = account.email || '';
  };
  request('/auth/me').then(data => { if (data.user) { updateLocal(data.user); renderAccount(); } }).catch(error => { if (error.message.includes('token') || error.message.includes('authorized')) { localStorage.removeItem('ss_token'); localStorage.removeItem('ss_user'); location.href = 'login.html'; } else console.warn('Account details could not be refreshed:', error.message); });
  renderAccount();

  const editForm = document.getElementById('editProfileForm');
  document.getElementById('editProfileButton')?.addEventListener('click', () => { editForm.classList.remove('hide'); editForm.scrollIntoView({behavior:'smooth',block:'center'}); });
  document.getElementById('cancelProfileEdit')?.addEventListener('click', () => editForm.classList.add('hide'));
  editForm?.addEventListener('submit', async event => {
    event.preventDefault(); const button = editForm.querySelector('[type="submit"]'); button.disabled = true;
    try { const data = await request('/auth/me',{method:'PATCH',body:JSON.stringify({name:editForm.elements.name.value.trim(),email:editForm.elements.email.value.trim(),avatar:account.avatar || ''})}); updateLocal(data.user); renderAccount(); setMessage(document.getElementById('profileMessage'),'Profile updated successfully.'); }
    catch(error) { setMessage(document.getElementById('profileMessage'),error.message,true); } finally { button.disabled = false; }
  });
  const photo = document.getElementById('profilePhotoInput');
  photo?.addEventListener('change', () => { const file = photo.files?.[0]; if (!file) return; if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setMessage(document.getElementById('profilePhotoMessage'),'Choose a JPG, PNG or WebP image.',true); return; }
    const reader = new FileReader(); reader.onload = () => { const image = new Image(); image.onload = () => { const canvas = document.createElement('canvas'); const scale = Math.min(1, 360 / Math.max(image.width,image.height)); canvas.width = Math.round(image.width*scale); canvas.height = Math.round(image.height*scale); canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height); let quality=0.68, avatar=canvas.toDataURL('image/jpeg',quality); while(avatar.length>65000 && quality>0.28){quality-=0.1;avatar=canvas.toDataURL('image/jpeg',quality);} request('/auth/me',{method:'PATCH',body:JSON.stringify({name:account.name,email:account.email,avatar})}).then(data=>{updateLocal(data.user);renderAccount();setMessage(document.getElementById('profilePhotoMessage'),'Profile photo updated.')}).catch(error=>setMessage(document.getElementById('profilePhotoMessage'),error.message,true)); }; image.src=reader.result; }; reader.readAsDataURL(file); photo.value='';
  });
  document.getElementById('removeProfilePhoto')?.addEventListener('click', async () => { try { const data=await request('/auth/me',{method:'PATCH',body:JSON.stringify({name:account.name,email:account.email,avatar:''})}); updateLocal(data.user); renderAccount(); setMessage(document.getElementById('profilePhotoMessage'),'Profile photo removed.'); } catch(error) { setMessage(document.getElementById('profilePhotoMessage'),error.message,true); } });

  const themeToggle = document.getElementById('themeToggle'); if(themeToggle){themeToggle.checked=(localStorage.getItem('ss_theme')||'dark')==='light';themeToggle.addEventListener('change',()=>{const theme=themeToggle.checked?'light':'dark';localStorage.setItem('ss_theme',theme);document.documentElement.dataset.theme=theme;});}
  const sidebarToggle = document.getElementById('sidebarToggle'); if(sidebarToggle){sidebarToggle.checked=localStorage.getItem('ss_sidebar_collapsed')==='1';sidebarToggle.addEventListener('change',()=>{const collapsed=sidebarToggle.checked;localStorage.setItem('ss_sidebar_collapsed',collapsed?'1':'0');document.body.classList.toggle('sidebar-collapsed',collapsed);document.querySelector('.sidebar-toggle')?.setAttribute('aria-expanded',String(!collapsed));});}
  document.getElementById('passwordForm')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]');button.disabled=true;try{const result=await request('/auth/me/password',{method:'PATCH',body:JSON.stringify({currentPassword:form.elements.currentPassword.value,newPassword:form.elements.newPassword.value})});form.reset();setMessage(document.getElementById('passwordMessage'),result.message||'Password updated successfully.');}catch(error){setMessage(document.getElementById('passwordMessage'),error.message,true);}finally{button.disabled=false;}});
  const logoutDialog=document.getElementById('logoutDialog');document.getElementById('openLogoutDialog')?.addEventListener('click',()=>logoutDialog.showModal());document.getElementById('cancelLogout')?.addEventListener('click',()=>logoutDialog.close());document.getElementById('confirmLogout')?.addEventListener('click',()=>{localStorage.removeItem('ss_token');localStorage.removeItem('ss_user');location.href='index.html';});logoutDialog?.addEventListener('click',event=>{if(event.target===logoutDialog)logoutDialog.close();});
  document.querySelectorAll('[data-copy-support]').forEach(button=>button.addEventListener('click',async()=>{const value=button.dataset.copySupport;try{await navigator.clipboard.writeText(value);setMessage(document.getElementById('issueMessage'),`Copied ${value} to clipboard.`);}catch{const input=document.createElement('textarea');input.value=value;document.body.append(input);input.select();document.execCommand('copy');input.remove();setMessage(document.getElementById('issueMessage'),`Copied ${value} to clipboard.`);}}));
  document.getElementById('issueForm')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const message=`SCAM SAVER technical issue\nIssue type: ${form.elements.type.value}\nDetails: ${form.elements.description.value.trim()}\nAccount: ${account.email||'Not available'}`;try{await navigator.clipboard.writeText(message);}catch{const input=document.createElement('textarea');input.value=message;document.body.append(input);input.select();document.execCommand('copy');input.remove();}setMessage(document.getElementById('issueMessage'),'Support message copied. Paste it into an email or contact the support number above.');});
})();
