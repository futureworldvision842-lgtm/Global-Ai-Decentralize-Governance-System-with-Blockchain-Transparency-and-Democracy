# Test report — honest site fix

Date: 10 Nov 2026. Worker was not deployed. History was not rewritten.

## Automated

`npm test` (`node --test tests/*.test.js`): 57 passed, 0 failed.

Added coverage:

- Sign-up source no longer requires a CNIC length check or a phone length check, and the account form no longer has those fields.
- Registration without a phone number or CNIC returns 201. A client-supplied identity number is not echoed, and `cnicLast4` and `phone` are null.
- Creating and listing a proposal returns `eligibleCount: null`, `turnout: null`, and `votesCast: 0`. The proposal source no longer uses `Math.max(2` to invent an eligible count.
- Every remaining `64% turnout` string in `gaigs/app.js` sits next to sample-data labelling.
- `config.js` points `platformApiBase` at `https://gaigs-api.gaigs.workers.dev`. A `YOUR_SUBDOMAIN` placeholder still falls back to the older host.

`node cloud-jarvis/index.js` with no `BOSS_NUMBER` prints `Set BOSS_NUMBER in the environment.` and exits 1 before loading chat dependencies.

## Browser

Headless Chrome against a local static server:

- The account form fields are name, email, password, country, and city. The page says this demo does not collect a CNIC or phone number.
- The interactive preview opens without creating a public account. The home screen is labelled INTERACTIVE DEMO. Sample votes are labelled SAMPLE DATA. A 64% turnout figure is not shown.
- Governance shows INTERACTIVE DEMO, SAMPLE DATA, and the demo-rule note. It does not show an invented eligible-member total.
- `mvp.html` account creation stays in the browser. The sample society is Sample Community (Islamabad). The water item is marked SAMPLE DATA. The funds tab says SIMULATION — NOT REAL MONEY.
- The root page still shows the faith-history timeline and the footer integrity note. The footer no longer includes a street address. The stage line is visible.

The account page does request `GET /api/auth/me` from `https://gaigs-api.gaigs.workers.dev` because `config.js` now points there. No account was registered during this check.

## Not run

`npx wrangler dev`, a live register/login/vote round trip, and a production Pages deploy were not run. Those would write to the live D1 database or publish the site.
