(function bootstrapClient(global) {
  const appContext = global.__APP_CONTEXT__ || {};

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      global.location.assign('/login');
    }
  }

  function bindGlobalButtons() {
    for (const button of document.querySelectorAll('#logoutButton')) {
      button.addEventListener('click', () => {
        logout().catch(() => {
          global.location.assign('/login');
        });
      });
    }
  }

  function detectDeviceLabel() {
    const parts = [];
    const userAgentData = navigator.userAgentData;
    if (userAgentData?.platform) parts.push(userAgentData.platform);
    if (navigator.platform) parts.push(navigator.platform);
    if (navigator.userAgent) parts.push(navigator.userAgent);
    return parts.filter(Boolean).join(' | ').slice(0, 400);
  }

  function lockUiForTerms() {
    document.body.classList.add('terms-locked');
  }

  function unlockUiForTerms() {
    document.body.classList.remove('terms-locked');
  }

  function bindTermsModal() {
    const modal = document.querySelector('#termsModal');
    const checkbox = document.querySelector('#termsAcknowledge');
    const acceptButton = document.querySelector('#termsAcceptButton');
    const feedback = document.querySelector('#termsFeedback');
    if (!modal || !checkbox || !acceptButton) return;

    const mustAccept = Boolean(appContext.currentUser && !appContext.currentUser.terms_accepted_at);
    if (mustAccept) {
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
      lockUiForTerms();
    } else {
      unlockUiForTerms();
    }

    checkbox.addEventListener('change', () => {
      acceptButton.disabled = !checkbox.checked;
    });

    acceptButton.addEventListener('click', async () => {
      if (!checkbox.checked) return;
      feedback.textContent = 'Registrando aceite do termo...';
      acceptButton.disabled = true;
      try {
        const response = await fetch('/api/auth/accept-terms', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            deviceLabel: detectDeviceLabel(),
            pagePath: global.location.pathname + global.location.search,
            platform: navigator.platform || '',
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Nao foi possivel registrar o aceite.');
        }
        feedback.textContent = 'Termo aceito. Recarregando o sistema...';
        global.location.reload();
      } catch (error) {
        feedback.textContent = error.message;
        acceptButton.disabled = false;
      }
    });
  }

  bindGlobalButtons();
  bindTermsModal();

  if (global.AcervoSearchController) {
    global.AcervoSearchController.init().catch(() => {
      const resultsList = document.querySelector('#resultsList');
      if (resultsList) {
        resultsList.innerHTML =
          '<article class="empty-card"><h4>Nao foi possivel iniciar a interface.</h4><p class="muted-copy">Recarregue a pagina e tente novamente.</p></article>';
      }
    });
  }
})(window);
