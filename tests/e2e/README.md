# End-to-end tests

Run against a running stack (`docker compose --profile camunda up`) with `RAZORPAY_MOCK=true` and a short
payment window (`PAYMENT_WINDOW=PT1M` in `.env`, used by T3 and T7).

```bash
python3 t1_happy.py        # T1: two subjects, two examiners each, one increase, official result, result email
python3 t_exceptions.py    # T2-T8: window closed, duplicate, forged payment, payment timeout, missing script,
                           #        examiner independence, no increase
python3 t_rbac.py          # Process View: exam cell only, checked on the API (403/401 for everyone else)
node ui.cjs                # happy path and Process View visibility through the React UI with Playwright
```

Set `BASE` to change the target (default `http://localhost:3000`, the nginx frontend) and `BACKEND` for the
direct backend URL (default `http://localhost:8080`, used to check the mock Razorpay endpoints).
Each test signs in as the seeded demo users. Use a fresh database (`docker compose down -v`) for repeatable
results, because a student can only have one open request per exam session. Run them in the order above.
