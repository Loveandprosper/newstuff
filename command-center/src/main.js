// Module entry. Later tasks add `import { x } from './x.js'` lines here.
import { startRouter } from './router.js';
import { initTabs } from './tabs.js';

initTabs();
startRouter();
