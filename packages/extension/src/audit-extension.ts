/**
 * Extension entry.
 *
 * axe-core is bundled straight into this file and used directly, rather than
 * injected into the page as the bookmarklet must do. Two consequences, both
 * good: the page's Content-Security-Policy is irrelevant, and the engine never
 * touches the page's own JavaScript context.
 */

import axe from 'axe-core';
import { runAudit, type AxeGlobal } from '../../web/src/audit-core.js';

void runAudit(() => axe as unknown as AxeGlobal);
