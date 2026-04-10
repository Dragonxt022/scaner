(function bootstrapLoginPage() {
  const form = document.querySelector('#loginForm');
  const cpfInput = document.querySelector('#loginCpf');
  const passwordInput = document.querySelector('#loginPassword');
  const feedback = document.querySelector('#loginFeedback');
  const switches = Array.from(document.querySelectorAll('[data-auth-target]'));
  const screens = Array.from(document.querySelectorAll('[data-auth-screen]'));
  const requestForm = document.querySelector('#passwordResetRequestForm');
  const requestFullName = document.querySelector('#requestFullName');
  const requestPassword = document.querySelector('#requestPassword');
  const requestCpf = document.querySelector('#resetRequestCpf');
  const requestFeedback = document.querySelector('#requestFeedback');
  const context = window.__LOGIN_CONTEXT__ || {};
  const allowedScreens = new Set(['login', 'request', 'sent']);

  function normalizeCpf(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 11);
  }

  function formatCpf(value) {
    const digits = normalizeCpf(value);
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  }

  function activateScreen(screenName, options = {}) {
    const target = allowedScreens.has(screenName) ? screenName : 'login';

    screens.forEach((screen) => {
      const isActive = screen.dataset.authScreen === target;
      screen.classList.toggle('active', isActive);
      screen.hidden = !isActive;
    });

    switches.forEach((control) => {
      const isActive = control.dataset.authTarget === target;
      control.classList.toggle('active', isActive);
      control.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    if (!options.skipHashUpdate) {
      window.location.hash = target;
    }
  }

  function getScreenFromHash() {
    const hashValue = String(window.location.hash || '').replace(/^#/, '').trim();
    return allowedScreens.has(hashValue) ? hashValue : 'login';
  }

  switches.forEach((control) => {
    control.addEventListener('click', () => {
      activateScreen(control.dataset.authTarget || 'login');
    });
  });

  window.addEventListener('hashchange', () => {
    activateScreen(getScreenFromHash(), { skipHashUpdate: true });
  });

  activateScreen(getScreenFromHash(), { skipHashUpdate: true });

  [cpfInput, requestCpf].forEach((input) => {
    if (!input) {
      return;
    }
    input.addEventListener('input', () => {
      input.value = formatCpf(input.value);
    });
  });

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      feedback.textContent = 'Validando acesso...';

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            cpf: normalizeCpf(cpfInput.value),
            password: passwordInput.value,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Falha ao autenticar.');
        }

        feedback.textContent = 'Acesso confirmado. Redirecionando...';
        const nextTarget = String(context.next || '').trim();
        const redirectTarget = nextTarget && nextTarget.startsWith('/') ? nextTarget : payload.redirectTo || '/';
        window.location.assign(redirectTarget);
      } catch (error) {
        feedback.textContent = error.message;
      }
    });
  }

  if (requestForm) {
    requestForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      requestFeedback.textContent = 'Registrando solicitacao de acesso...';
      try {
        const response = await fetch('/api/auth/request-access', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            cpf: normalizeCpf(requestCpf.value),
            fullName: String(requestFullName.value || '').trim(),
            password: requestPassword.value,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Nao foi possivel registrar a solicitacao.');
        }
        requestFeedback.textContent = payload.message || 'Solicitacao registrada.';
        requestFullName.value = '';
        requestPassword.value = '';
        requestCpf.value = formatCpf(requestCpf.value);
        activateScreen('sent');
      } catch (error) {
        requestFeedback.textContent = error.message;
      }
    });
  }
})();
