import { getCanonicalStore } from './canonicalStore.js';
/** Move due transient FCM failures back to the worker's queued state. */
export async function requeueDueFcmFailures():Promise<number>{try{return(await getCanonicalStore()).run(`UPDATE internal_notifications SET delivery_state='queued' WHERE delivery_state='failed' AND (next_attempt_at IS NULL OR next_attempt_at<=CURRENT_TIMESTAMP) AND attempt_count<max_attempts`).then(r=>r.rowCount);}catch{return 0;}}
