#!/usr/bin/env bash
set -euo pipefail

# Preferred activation inputs. Legacy aliases are accepted only for backward compatibility.
project_id="${KURUKOO_CLOUD_RUN_PROJECT_ID:-${GCP_PROJECT_ID:-}}"
region="${KURUKOO_CLOUD_RUN_REGION:-${GCP_REGION:-}}"
service="${KURUKOO_CLOUD_RUN_SERVICE:-${KURUKOO_STAGING_SERVICE:-}}"
image="${KURUKOO_STAGING_IMAGE:-}"
base_url="${KURUKOO_STAGING_BASE_URL:-}"

require_value() {
  local name="$1" value="$2"
  if [[ -z "${value// }" ]]; then
    echo "Missing required staging activation input: ${name}" >&2
    exit 2
  fi
}

require_value 'KURUKOO_CLOUD_RUN_PROJECT_ID (or legacy GCP_PROJECT_ID)' "$project_id"
require_value 'KURUKOO_CLOUD_RUN_REGION (or legacy GCP_REGION)' "$region"
require_value 'KURUKOO_CLOUD_RUN_SERVICE (or legacy KURUKOO_STAGING_SERVICE)' "$service"
require_value 'KURUKOO_STAGING_IMAGE' "$image"
require_value 'KURUKOO_STAGING_BASE_URL' "$base_url"

base_url="${base_url%/}"
case "$base_url" in
  https://*) ;;
  *) echo 'KURUKOO_STAGING_BASE_URL must use HTTPS' >&2; exit 2 ;;
esac

if ! command -v gcloud >/dev/null 2>&1; then
  echo 'gcloud CLI is required for staging deployment' >&2
  exit 2
fi
if ! gcloud auth print-access-token >/dev/null 2>&1; then
  echo 'Authenticated gcloud access is required for staging deployment' >&2
  exit 2
fi

# Deployment is intentionally impossible until every target value above is explicit.
gcloud run deploy "$service" \
  --project "$project_id" \
  --region "$region" \
  --image "$image" \
  --update-env-vars "KURUKOO_STAGING_BASE_URL=$base_url" \
  --quiet

service_url="$(gcloud run services describe "$service" --project "$project_id" --region "$region" --format='value(status.url)')"
echo "Staging service deployed: $service_url"

curl --fail --silent --show-error --max-time 20 "$base_url/readyz" >/dev/null
echo "Staging readiness probe passed: $base_url/readyz"
