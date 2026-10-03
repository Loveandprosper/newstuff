// Health: workout logger, stats, Instagram. Shell only for now.
import { registerPage } from '../router.js';
import { shellSection, shellPlaceholder, shellHeader } from './shell.js';

export function mountHealth(el) {
  el.innerHTML = shellHeader('Health') +
    shellSection('logger', 'Workout logger', shellPlaceholder()) +
    shellSection('stats', 'Stats over time', shellPlaceholder()) +
    shellSection('instagram', 'Instagram (@mykfytt)', shellPlaceholder());
}

registerPage('health', { title: 'Health', accent: 'var(--health)', mount: mountHealth, badge: () => 0 });
