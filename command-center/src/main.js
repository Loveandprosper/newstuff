// Module entry. Later tasks add `import { x } from './x.js'` lines here.
import { startRouter, navigate, currentRoute } from './router.js';
import { db } from './db.js';
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
import { initLayout } from './layout.js';
import { migrateRunOnce } from './migrate.js';

// Page modules register themselves on import (mount* imported so the bundler includes them).
// LOAD-BEARING: removing this line drops the page modules from the bundle; do not delete.
void [mountHome, mountWork, mountCards, mountHealth, mountWf, mountInbox];
initTabs();
initBadges();
startRouter();
initQuickAdd();
initSearch();
initTheme();
initShift();
initAsk();
initLayout();
// One-time data migration (guarded; does nothing offline or if already done).
migrateRunOnce().catch(() => {});

// Drain the offline write queue at startup, when back online, and when the app is shown again.
// If anything synced, re-render the current tab so it shows the saved data.
function mainFlushQueue() {
  db.flush().then((r) => {
    if (r && r.flushed > 0 && currentRoute()) navigate(currentRoute());
  }).catch((e) => console.warn('Sync of offline changes failed', e));
}
mainFlushQueue();
window.addEventListener('online', mainFlushQueue);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') mainFlushQueue(); });
