# Logging Standards (Observed)

Scope note: this guide documents logging behavior currently implemented in `services/api-service`.

## Logging stack in use

- Central setup: `services/api-service/src/core/logging_config.py`.
- API app initializes logging at startup (`src/main.py`):
  - `setup_logging()`
  - `logger = get_logger(__name__)`
- Log output uses a custom formatter and filter with optional color in TTY.

## Required pattern per Python module

Use module-level logger:

```python
from src.core.logging_config import get_logger
logger = get_logger(__name__)
```

Do not use `print` for operational logs in API modules.

## Log levels and filtering (current behavior)

- App log level env: `APP_LOG_LEVEL` (default `DEBUG`).
- External log min level env: `APP_EXTERNAL_LOG_LEVEL` (default `ERROR`).
- Uvicorn loggers are set to `INFO`.
- Known noisy external loggers are reduced (apscheduler, urllib3, httpx, passlib, tzlocal, bitwarden_sdk).

## Structured operation logging (Data Viewer)

Data Viewer endpoints log operation metrics through `log_operation(...)` with:

- `request_id`
- `username`
- `table_id`
- `query_time_ms`
- `row_count`
- `status_code`

If endpoint logic depends on request correlation, keep `X-Request-ID` propagation intact.

## Security and privacy rules

- Never log secrets, tokens, or credential payloads.
- Do not log raw exception internals to clients.
- Keep server-side exception logging for debugging, but sanitize client responses.

## Practical do/dont

- Do:
  - Log high-value events around external calls and domain errors.
  - Include IDs/correlation fields when available.
- Dont:
  - Add noisy per-row debug logs in hot paths.
  - Duplicate logs at multiple layers for the same failure unless needed.

## TBD / optional

- Centralized log aggregation target (ELK, Loki, Datadog, etc.) is not documented in this repo.
- Frontend logging policy beyond local `console.*` usage is not formally defined.
