# TechFusion AI – Load Testing Suite

Load tests target **500 devices / 50 concurrent technicians** as realistic MSP fleet scale.

## Targets

| Scenario | Target p95 latency | Target error rate |
|---|---|---|
| Device telemetry ingestion | < 500ms | < 0.1% |
| AI chat sessions | < 5000ms | < 1% |
| Report generation | < 10000ms | < 1% |
| Remote support sessions | < 2000ms | < 1% |
| Auth (login/refresh) | < 1000ms | < 0.1% |
| Mixed concurrent load | < 2000ms avg over all | < 0.5% |

## Running

```bash
k6 run test/load/telemetry.js
k6 run test/load/ai-chat.js
k6 run test/load/reports.js
k6 run test/load/remote-support.js
k6 run test/load/mixed-workload.js
```

Or run all at once:

```bash
for f in test/load/*.js; do k6 run "$f"; done
```
