# RESILIENCE NOTES

## Part A - Before resilience

- Normal speed=0.006792 seconds
- Slow mode on=10.290939 seconds
-The 3rd attempt was OK the first two were bad gateways 502

## Part B — Timeout Implementation

- Timeout value chosen: 1500 ms
- Justification: A healthy local API call finishes in under 50 ms. 1500 ms provides sufficient buffer for minor network jitter while ensuring requests fail fast before the user gives up or browser default timeouts kick in.
- Proven duration in slow mode: ~1.5s
