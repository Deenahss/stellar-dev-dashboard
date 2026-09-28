# Security Policy

## Supported Versions

Security fixes are applied to the latest release on the default branch. Older
releases may not receive backports; please upgrade to the latest version before
reporting an issue.

## Reporting a Vulnerability

Please do **not** open a public issue for security vulnerabilities. Instead,
report them privately using GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
feature for this repository, or contact the maintainers directly.

When reporting, please include:

- A description of the vulnerability and its impact.
- Steps to reproduce (proof of concept if possible).
- Affected versions and environment details.
- Any suggested remediation.

We aim to acknowledge reports within a few business days and will keep you
updated as we investigate and remediate.

## Privileged Actions and Audit Export

Privileged dashboard actions — including Mainnet writes and settings changes —
are recorded in a tamper-evident audit log. The log is append-only and each
entry is chained to the previous entry via a cryptographic hash so that any
modification, reordering, or deletion of historical records is detectable.

## Reporting a Vulnerability
If you discover a security vulnerability within this project, please send an e-mail to security@stellar-dev-dashboard.org. All security vulnerabilities will be promptly addressed.

### 3. Pre-Sign Risk Review
Signing is treated as a privileged action, because it usually is one. Before any
transaction reaches a wallet, it is parsed and run through a declarative ruleset
([`docs/api/riskRules.md`](docs/api/riskRules.md)) that describes every
operation in plain language.

- **Coverage:** all four signing surfaces — `<TransactionSigner>` (including
  XDR pasted from outside the dashboard), `<SignatureCollector>`,
  `<AnchorIntegration>` (SEP-10 challenges), and
  `signAndSubmitTransaction()`.
- **Gating:** irreversible operations — disabling the master key, changing
  thresholds or signers, merging the account, removing or unlimiting a
  trustline, spending a large share of the account, or calling an unapproved
  contract — are escalated to `high` and require an explicit acknowledgement.
  The signing call is unreachable until the user confirms.
- **Fail open, state the caveat:** a failed simulation or an unavailable account
  snapshot degrades the summary and says so on screen; it never silently
  presents an unverified transaction as verified, and never blocks a user
  because a node was down.
- **Allowlist by default:** the approved-contract list ships empty, so any
  contract invocation is flagged until the user opts in.
- **Full-transaction review:** every operation is shown, including those that
  matched no rule, so a dangerous operation cannot hide between unremarkable
  ones.
