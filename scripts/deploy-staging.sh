#!/usr/bin/env bash
set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID to the target Cloud Run project.}"
: "${GCP_REGION:?Set GCP_REGION to the target Cloud Run region.}"
: "${KURUKOO_STAGING_IMAGE:?Set KURUKOO_STAGING_IMAGE to the immutable container image reference.}"
: "${KURUKOO_STAGING_BASE_URL:?Set KURUKOO_STAGING_BASE_URL to the public HTTPS staging URL.}"

service="${KURUKOO_STAGING_SERVICE:-kurukoo-staging}"
base_url="${KURUKOO_STAGING_BASE_URL%/}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI is required for staging deployment" >&2
  exit 2
fi

case "$base_url" in
  https://*) ;;
  *) echo "KURUKOO_STAGING_BASE_URL must use HTTPS" >&2; exit 2 ;;
esac

gcloud run deploy "$service" \
  --project "$GCP_PROJECT_ID" \
  --region "$GCP_REGION" \
  --image "$KURUKOO_STAGING_IMAGE" \
  --update-env-vars "KURUKOO_STAGING_BASE_URL=$base_url" \
  --quiet

service_url="$(gcloud run services describe "$service" --project "$GCP_PROJECT_ID" --region "$GCP_REGION" --format='value(status.url)')"
echo "Staging service deployed: $service_url"

curl --fail --silent --show-error --max-time 20 "$base_url/readyz" >/dev/null
echo "Staging readiness probe passed: $base_url/readyz"
