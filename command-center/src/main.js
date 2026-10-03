// Module entry. Later tasks add `import { x } from './x.js'` lines here.
import { startRouter } from './router.js';
import { initTabs } from './tabs.js';
import { initQuickAdd } from './quickadd.js';
import { initSearch } from './search.js';
import { initShift } from './shift.js';
import { initTheme } from './theme.js';
import { mountHome } from './pages/home.js';
import { mountWork } from './pages/work.js';
import { mountCards } from './pages/cards.js';
import { mountHealth } from './pages/health.js';
import { mountWf } from './pages/wf.js';
import { mountInbox } from './pages/inbox.js';
import { initBadges } from './badges.js';
import { initAsk } from './ask.js';

// Page modules register themselves on import (mount* imported so the bundler includes them).
void [mountHome, mountWork, mountCards, mountHealth, mountWf, mountInbox];
initTabs();
initBadges();
startRouter();
initQuickAdd();
initSearch();
initTheme();
initShift();
initAsk();
