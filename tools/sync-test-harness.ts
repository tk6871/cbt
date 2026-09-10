// Bundled only by tests into ignored work/, never imported by production entries.
import * as cloud from '../src/cbt/cloudSync';
import { studyStore, db } from '../src/cbt/storage';
import * as recovery from '../src/cbt/syncRecovery';
Object.assign(window, { syncTest: { cloud, studyStore, db, recovery } });
