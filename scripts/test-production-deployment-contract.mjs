import fs from 'node:fs';

const cloudbuild = fs.readFileSync('cloudbuild.yaml', 'utf8');
const service = fs.readFileSync('deploy/cloud-run/service.yaml', 'utf8');
const dockerfile = fs.readFileSync('Dockerfile', 'utf8');
const failures = [];

const requireMarker = (source, marker, reason) => {
  if (!source.includes(marker)) failures.push(`${reason}: missing ${marker}`);
};

requireMarker(cloudbuild, 'scripts/production-preflight.mjs', 'Cloud Build must run production preflight before deployment');
requireMarker(cloudbuild, 'KURUKOO_DATABASE_MODE=postgres', 'Cloud Build must select durable PostgreSQL for production');
requireMarker(cloudbuild, 'KURUKOO_PERSISTENT_STATE_REQUIRED=true', 'Cloud Build must require persistent state');
requireMarker(cloudbuild, 'KURUKOO_JOB_MODE=in_process', 'Cloud Build must declare the single-process job mode');
requireMarker(cloudbuild, 'KURUKOO_WORKERS=1', 'Cloud Build must keep one worker until distributed ownership is certified');
requireMarker(cloudbuild, 'KURUKOO_EXTERNAL_EXECUTION_ENABLED=false', 'Cloud Build must keep external execution fail-closed by default');
requireMarker(cloudbuild, '--set-secrets', 'Cloud Run must receive secrets through Secret Manager references');
requireMarker(cloudbuild, 'JWT_SECRET=', 'Cloud Run must inject JWT_SECRET from Secret Manager');
requireMarker(cloudbuild, 'DATABASE_URL=', 'Cloud Run must inject DATABASE_URL from Secret Manager');
requireMarker(cloudbuild, 'KURUKOO_SECRET_SOURCE=secret_manager', 'Cloud Build must declare Secret Manager as the secret source');
requireMarker(cloudbuild, 'KURUKOO_STORAGE_MODE=local', 'Cloud Build must declare the current attachment storage posture');
requireMarker(cloudbuild, '_MAX_INSTANCES', 'Cloud Build must expose an explicit instance cap');
if (!/_MAX_INSTANCES:\s*['"]1['"]/.test(cloudbuild)) failures.push('Cloud Build must cap production at one instance until distributed worker ownership is certified');

requireMarker(service, 'KURUKOO_DATABASE_MODE', 'Cloud Run manifest must declare a persistence mode');
requireMarker(service, 'KURUKOO_EXTERNAL_EXECUTION_ENABLED', 'Cloud Run manifest must declare external execution state');
requireMarker(service, 'KURUKOO_WORKERS', 'Cloud Run manifest must declare worker count');
requireMarker(service, 'KURUKOO_SECRET_SOURCE', 'Cloud Run manifest must declare Secret Manager as the secret source');
requireMarker(service, 'KURUKOO_STORAGE_MODE', 'Cloud Run manifest must declare attachment storage posture');
if (/KURUKOO_DATABASE_MODE\s*\n?\s*value:\s*["']sqljs["']/.test(service)) failures.push('Cloud Run manifest must not select SQL.js for production');
if (/autoscaling\.knative\.dev\/maxScale:\s*["']([2-9]|[1-9][0-9]+)["']/.test(service)) failures.push('Cloud Run manifest must remain single-instance until distributed ownership is certified');

requireMarker(dockerfile, 'USER node', 'Production image must not run as root');
requireMarker(dockerfile, '/readyz', 'Production image must retain readiness health checking');

if (failures.length) {
  console.error('Production deployment contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Production deployment contract passed: durable persistence selection, fail-closed execution, Secret Manager wiring, one-instance safety, preflight gate, non-root image, and readiness probe are present.');
