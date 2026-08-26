# Africa’s Talking Staging Readiness

This runbook prepares **one canonical Kurukoo runtime** for Africa’s Talking staging activation. It does not create a second channel stack, send an SMS, initiate airtime, or assert handset delivery. The runtime accepts provider callbacks at root paths so a public staging deployment can configure the exact callback URLs required by Africa’s Talking.

| Callback purpose | Public callback template | Runtime owner |
|---|---|---|
| Inbound SMS and delivery reports | `{KURUKOO_STAGING_BASE_URL}/webhook/sms` | Shared SMS boundary and canonical delivery state |
| USSD session requests | `{KURUKOO_STAGING_BASE_URL}/ussd` | Session-persisted USSD menu boundary |
| Airtime completion callbacks | `{KURUKOO_STAGING_BASE_URL}/airtime` | Confirmation-gated canonical airtime operation owner |

## Configuration Boundary

The following values are **non-secret configuration**. Each callback value must be a public HTTPS URL, must be configured for the same deployed staging service, and must not be replaced with a hardcoded repository domain. `AFRICASTALKING_USERNAME=sandbox` is public sandbox configuration; it is not a credential.

| Variable | Required when | Expected value or policy |
|---|---|---|
| `AFRICASTALKING_USERNAME` | Any Africa’s Talking channel is enabled | `sandbox` for sandbox verification, or the approved non-production username |
| `AFRICASTALKING_SENDER_ID` | SMS outbound is enabled | Approved sender ID; no source-code default |
| `AFRICASTALKING_SMS_SHORTCODE` | SMS callback routing requires it | Approved shortcode; no source-code default |
| `AFRICASTALKING_USSD_SERVICE_CODE` | USSD is enabled | Approved service code; no source-code default |
| `AFRICASTALKING_SMS_CALLBACK_URL` | `FF_SMS=true` | `{KURUKOO_STAGING_BASE_URL}/webhook/sms` |
| `AFRICASTALKING_USSD_CALLBACK_URL` | `FF_USSD=true` | `{KURUKOO_STAGING_BASE_URL}/ussd` |
| `AFRICASTALKING_AIRTIME_CALLBACK_URL` | `FF_AIRTIME=true` | `{KURUKOO_STAGING_BASE_URL}/airtime` |
| `FF_SMS` | To enable outbound SMS after review | `true` only after staging configuration is complete; otherwise `false` |
| `FF_USSD` | To enable USSD routing after review | `true` only after staging configuration is complete; otherwise `false` |
| `FF_AIRTIME` | To allow confirmation-gated airtime submission after review | `true` only after staging configuration is complete; otherwise `false` |

`AFRICASTALKING_API_KEY` is a **secret only**. It must be injected by the deployment secret manager or approved secure connector and must never be placed in source, GitHub workflow text, public configuration, test output, or readiness JSON. The provider readiness snapshot checks only whether secret configuration is present; it never reads back or serializes the secret.

## Readiness Endpoints

The public runtime retains its existing health semantics and adds a channel-specific configuration view.

| Endpoint | Purpose | What a successful response proves | What it does not prove |
|---|---|---|---|
| `GET /health` | General service health and platform snapshot | The runtime can access its canonical store | Provider acceptance, callback reachability, SMS delivery, or airtime completion |
| `GET /ready` | Non-secret Africa’s Talking configuration snapshot | Database availability and configured/not-configured status for SMS, USSD, OTP, airtime, and provider credentials | A provider call, a live handset event, or a public callback round-trip |
| `GET /readyz` | Deployment readiness gate | Persistence, capability, migration, and configured runtime readiness conditions | Africa’s Talking external completion evidence |

> `GET /ready` intentionally reports provider status as `external_unavailable` whenever credentials are configured but no external round-trip evidence exists. This prevents configuration from being mistaken for live delivery proof.

## Guarded Cloud Run Activation

`scripts/deploy-staging.sh` fails closed unless all target values are supplied explicitly. It accepts legacy `GCP_PROJECT_ID`, `GCP_REGION`, and `KURUKOO_STAGING_SERVICE` aliases only for compatibility; new activation should provide the variables below.

| Required activation input | Required property |
|---|---|
| `KURUKOO_CLOUD_RUN_PROJECT_ID` | Target Google Cloud project, supplied by the authorized operator |
| `KURUKOO_CLOUD_RUN_REGION` | Target Cloud Run region, supplied by the authorized operator |
| `KURUKOO_CLOUD_RUN_SERVICE` | Exact staging service name, supplied by the authorized operator |
| `KURUKOO_STAGING_IMAGE` | Immutable container image reference, preferably digest-pinned |
| `KURUKOO_STAGING_BASE_URL` | Final public HTTPS staging URL used for callback templates and `/readyz` probe |
| Authenticated `gcloud` identity | Authorized to deploy and describe the specified Cloud Run service |

The deployment helper requires `gcloud auth print-access-token` to succeed, deploys only the explicit service/image pair, then probes `{KURUKOO_STAGING_BASE_URL}/readyz`. It cannot infer an image, project, region, service name, public URL, or operator identity.

## Activation Sequence

First deploy the reviewed branch with feature flags disabled, then verify `GET /health`, `GET /ready`, and `GET /readyz` on the supplied public HTTPS URL. Next configure the three callback templates in the Africa’s Talking dashboard and enable only the channel flags approved for staging. Finally, obtain provider-side acceptance and callback evidence using real staging inputs. A provider API acceptance result is not a handset-delivery result, and airtime remains pending until the provider callback updates the canonical operation.

Until an authorized operator supplies the explicit Cloud Run inputs and a public HTTPS endpoint, the correct acceptance state is **LIVE CALLBACK PROOF: EXTERNAL DEPENDENCY**.
