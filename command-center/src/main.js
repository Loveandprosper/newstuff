// Module entry. Later tasks add `import { x } from './x.js'` lines here.
import { startRouter } from './router.js';
import { initTabs } from './tabs.js';
import { initQuickAdd } from './quickadd.js';
import { initSearch } from './search.js';

initTabs();
startRouter();
initQuickAdd();
initSearch();
