(function bootstrapSecurityPage() {
  const form = document.querySelector('#securityForm');
  const currentPassword = document.querySelector('#securityCurrentPassword');
  const newPassword = document.querySelector('#securityNewPassword');
  const confirmPassword = document.querySelector('#securityConfirmPassword');
  const feedback = document.querySelector('#securityFeedback');

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (newPassword.value !== confirmPassword.value) {
      feedback.textContent = 'A confirmacao da nova senha nao confere.';
      return;
    }

    feedback.textContent = 'Atualizando senha...';
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentPassword.value,
          newPassword: newPassword.value,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Nao foi possivel atualizar a senha.');
      }
      feedback.textContent = 'Senha alterada com sucesso. Redirecionando...';
      window.location.assign(window.__APP_CONTEXT__?.canAccessAdmin ? '/config' : '/');
    } catch (error) {
      feedback.textContent = error.message;
    }
  });
})();
