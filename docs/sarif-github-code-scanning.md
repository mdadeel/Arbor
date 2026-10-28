# SARIF 2.1.0 Export & GitHub Security Tab Integration

Arbor emits findings in **OASIS SARIF 2.1.0** (`https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json`), validated at generation time against the official SARIF 2.1.0 JSON Schema (`src/server/analysis/sarif-validator.ts`).

Uploading an Arbor `.sarif` report to **GitHub Code Scanning** surfaces Arbor's security, architecture, secret, environment, and technical-debt findings directly inside your repository's **Security -> Code scanning alerts** tab and inline on pull-request diffs.

---

## Prerequisites on GitHub

- **Public repositories:** GitHub Code Scanning is available for free — ensure **Code scanning** is enabled under **Settings -> Code security**.
- **Private / internal repositories:** Requires GitHub Code Security / GitHub Advanced Security enabled on the repository or organization.
- **Workflow / token permissions:** Uploading SARIF requires `security-events: write` (plus `contents: read` and `actions: read` in GitHub Actions).

---

## Option 1 — Automated Upload in GitHub Actions (Recommended)

`npm run analyze:local` runs Arbor's deterministic AST and dependency analyzer directly against the checked-out repository without requiring PostgreSQL or Redis, validates the SARIF 2.1.0 payload against the official schema, and writes `arbor-results.sarif` for `github/codeql-action/upload-sarif@v3`:

```yaml
name: Arbor Code Scanning (SARIF)

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read
  actions: read
  security-events: write

jobs:
  arbor-sarif:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout target repository
        uses: actions/checkout@v4
        with:
          path: target-repo

      - name: Checkout Arbor analyzer
        uses: actions/checkout@v4
        with:
          repository: mdadeel/Arbor
          path: arbor-cli

      - name: Install Arbor dependencies
        working-directory: arbor-cli
        run: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --ignore-scripts

      - name: Run Arbor static audit & emit validated SARIF 2.1.0
        working-directory: arbor-cli
        run: |
          npx tsx scripts/analyze-dir.ts ../target-repo \
            --sarif ../target-repo/arbor-results.sarif \
            --branch "${GITHUB_REF_NAME}" \
            --commit "${GITHUB_SHA}" \
            --repo-url "${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}"

      - name: Upload SARIF to GitHub Security tab
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: target-repo/arbor-results.sarif
          checkout_path: target-repo
          category: arbor-static-analysis
```

*(When scanning the Arbor repository itself, omit the second checkout and run `npm run analyze:local -- . --sarif arbor-results.sarif --branch "${GITHUB_REF_NAME}" --commit "${GITHUB_SHA}"` directly.)*

---

## Option 2 — Export from Arbor Web Dashboard or API & Upload via `gh` CLI

1. **Download the `.sarif` file from a completed project audit:**
   - **Dashboard UI:** Open `/projects/<slug>`, click **Export Report**, and select **SARIF 2.1.0 (.sarif)**.
   - **Authenticated HTTP endpoint:**
     ```text
     GET /api/projects/<slug>/analyses/<analysisId>/sarif
     ```
     Returns `Content-Type: application/sarif+json; charset=utf-8` validated against the OASIS SARIF 2.1.0 schema, including `suppressions` for any policy-suppressed or triaged (`accepted_risk` / `false_positive`) findings.

2. **Upload to GitHub's Code Scanning REST API (`POST /repos/{owner}/{repo}/code-scanning/sarifs`):**

   GitHub's REST API expects the SARIF file compressed with `gzip` and base64-encoded alongside the analyzed `commit_sha` (`40`-character SHA) and Git `ref` (e.g. `refs/heads/main`):

   ```bash
   SARIF_B64="$(gzip -c project-analysis.sarif | base64 | tr -d '\n')"

   gh api \
     --method POST \
     -H "Accept: application/vnd.github+json" \
     repos/OWNER/REPO/code-scanning/sarifs \
     -f commit_sha="0123456789abcdef0123456789abcdef01234567" \
     -f ref="refs/heads/main" \
     -f sarif="${SARIF_B64}" \
     -f tool_name="Arbor"
   ```

3. **View alerts in GitHub:**
   Navigate to `https://github.com/OWNER/REPO/security/code-scanning` and filter by **Tool: Arbor**.

---

## How Arbor Maps Findings to SARIF 2.1.0

| Arbor Field | SARIF 2.1.0 Mapping |
| --- | --- |
| `ruleId ?? id` | `result.ruleId` & deduplicated `tool.driver.rules[i].id` |
| `severity` (`critical` / `warning` / `info`) | `level` (`error` / `warning` / `note`) + `properties["security-severity"]` (`9.0` / `5.5` / `2.0`) on security rules |
| `file` + `line` | `locations[0].physicalLocation` (`uriBaseId: "%SRCROOT%"`, `region.startLine >= 1`) |
| `paths[]` (e.g. import cycles) | Primary path in `locations[0]`; remaining cycle modules in `relatedLocations[]` |
| Repository-wide checks (no `file`) | Anchored to `.env.example`, `README.md`, or `package.json` (`startLine: 1`) so GitHub Code Scanning accepts every result |
| `explanation`, `impact`, `recommendation` | `tool.driver.rules[i].help.markdown` rendered in GitHub's alert detail view |
| `policySuppressed` & `FindingTriage` (`accepted_risk` / `false_positive`) | `result.suppressions[]` (`kind: "external"`, `status: "accepted"`) |
