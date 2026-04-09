(function bootstrapLoginPage() {
  const form = document.querySelector('#loginForm');
  const cpfInput = document.querySelector('#loginCpf');
  const passwordInput = document.querySelector('#loginPassword');
  const feedback = document.querySelector('#loginFeedback');
  const requestForm = document.querySelector('#passwordResetRequestForm');
  const requestCpf = document.querySelector('#resetRequestCpf');
  const applyForm = document.querySelector('#passwordResetApplyForm');
  const applyCpf = document.querySelector('#resetApplyCpf');
  const applyCode = document.querySelector('#resetApplyCode');
  const applyPassword = document.querySelector('#resetApplyPassword');
  const resetFeedback = document.querySelector('#passwordResetFeedback');
  const context = window.__LOGIN_CONTEXT__ || {};

  function normalizeCpf(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 11);
  }

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
      resetFeedback.textContent = 'Registrando solicitacao de recuperacao...';
      try {
        const response = await fetch('/api/auth/request-password-reset', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            cpf: normalizeCpf(requestCpf.value),
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Nao foi possivel registrar a solicitacao.');
        }
        resetFeedback.textContent = payload.message || 'Solicitacao registrada.';
      } catch (error) {
        resetFeedback.textContent = error.message;
      }
    });
  }

  if (applyForm) {
    applyForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      resetFeedback.textContent = 'Redefinindo senha...';
      try {
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            code: applyCode.value.trim(),
            cpf: normalizeCpf(applyCpf.value),
            newPassword: applyPassword.value,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Nao foi possivel redefinir a senha.');
        }
        resetFeedback.textContent = 'Senha redefinida com sucesso. Agora faca login.';
        applyCode.value = '';
        applyPassword.value = '';
      } catch (error) {
        resetFeedback.textContent = error.message;
      }
    });
  }
})();
