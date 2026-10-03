// Cards: preference card builder (surgeon + procedure). Shell only for now.
import { registerPage } from '../router.js';
import { shellSection, shellPlaceholder, shellHeader } from './shell.js';

export function mountCards(el) {
  el.innerHTML = shellHeader('Cards') +
    shellSection('search', 'Find a card', shellPlaceholder()) +
    shellSection('cards', 'Preference cards', shellPlaceholder('One card per surgeon + procedure. Coming in a later update.')) +
    shellSection('picklist', 'Pick list mode', shellPlaceholder());
}

registerPage('cards', { title: 'Cards', accent: 'var(--cards)', mount: mountCards, badge: () => 0 });
