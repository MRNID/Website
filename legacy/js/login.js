const loginForm = document.getElementById('login-form');
const messageBox = document.getElementById('message');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const payload = {
    username: formData.get('username'),
    password: formData.get('password'),
  };

  try {
    messageBox.textContent = 'Đang đăng nhập...';

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Đăng nhập thất bại.');
    }

    localStorage.setItem('tenant_admin_token', json.data.token);
    localStorage.setItem('tenant_admin_user', JSON.stringify(json.data.user));
    window.location.href = '/admin/';
  } catch (error) {
    messageBox.textContent = error.message;
  }
});
