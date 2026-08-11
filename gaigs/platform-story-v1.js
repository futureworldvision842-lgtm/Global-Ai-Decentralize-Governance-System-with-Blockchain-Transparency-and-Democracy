(function initPlatformStory() {
  const authScreen = document.getElementById('authScreen');
  if (!authScreen) return;

  const authCard = authScreen.querySelector('.auth-card');
  const authTabs = Array.from(authScreen.querySelectorAll('[data-auth-tab]'));

  function openAuth(mode) {
    const requested = mode === 'login' ? 'login' : 'signup';
    const tab = authTabs.find(button => button.dataset.authTab === requested);
    if (tab) tab.click();
    if (authCard) authCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      const field = document.getElementById(requested === 'login' ? 'loginEmail' : 'signupName');
      if (field && window.matchMedia('(min-width: 901px)').matches) field.focus({ preventScroll: true });
    }, 520);
  }

  authScreen.querySelectorAll('[data-public-auth]').forEach(button => {
    button.addEventListener('click', () => openAuth(button.dataset.publicAuth));
  });

  authScreen.querySelectorAll('[data-public-preview]').forEach(button => {
    button.addEventListener('click', () => {
      const preview = document.getElementById('demoLogin');
      if (preview) preview.click();
    });
  });

  const storySections = Array.from(authScreen.querySelectorAll('.story-section, .story-final'));
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('story-motion');
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('story-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    storySections.forEach(section => revealObserver.observe(section));
  } else {
    storySections.forEach(section => section.classList.add('story-visible'));
  }

  const navLinks = Array.from(authScreen.querySelectorAll('.public-nav nav a[href^="#"]'));
  if ('IntersectionObserver' in window && navLinks.length) {
    const linkById = new Map(navLinks.map(link => [link.getAttribute('href').slice(1), link]));
    const navigationObserver = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach(link => link.classList.toggle('active', link === linkById.get(visible.target.id)));
    }, { rootMargin: '-20% 0px -65% 0px', threshold: [0.05, 0.2, 0.45] });
    linkById.forEach((link, id) => {
      const section = document.getElementById(id);
      if (section) navigationObserver.observe(section);
    });
  }
})();
