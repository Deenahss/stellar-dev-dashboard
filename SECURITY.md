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

## Passkey Smart Wallet Threat Model (#974)

This section covers the additional attack surface introduced by WebAuthn / secp256r1 passkey-based smart wallet accounts (Protocol 21+).

### What is a Passkey Smart Wallet?

A passkey smart wallet is a Soroban contract account (C-address) whose `__check_auth` function verifies P-256 (secp256r1) WebAuthn signatures instead of classical Ed25519 signatures.  The dashboard creates credentials, derives signing challenges, and routes signed auth entries through a fee-sponsor relayer.

### Passkey Threat Model Matrix

| Threat Vector | Description | Remediation Strategy |
| :--- | :--- | :--- |
| **Credential theft via XSS** | An XSS attacker injects a script that calls `navigator.credentials.get()` to silently obtain a signed assertion. | The authenticator requires user-presence (UP) and user-verification (UV) gestures for every assertion. Silent signing without the user touching the authenticator is impossible. CSP (no `unsafe-inline`) prevents the injection vector. |
| **Phishing via origin spoofing** | A phishing site at `stellar-dev-dashb0ard.com` tricks the user into asserting a credential registered at `stellar-dev-dashboard.com`. | WebAuthn credentials are bound to the RP ID (origin hostname). A different origin cannot obtain a valid assertion for our credential, and the contract verifies the clientDataJSON origin on-chain. |
| **Relayer compromise / transaction substitution** | A malicious or compromised relayer substitutes a different transaction before broadcasting. | The authenticator signs the hash of the Soroban auth entry (not the full transaction). The smart wallet contract verifies the signed hash on-chain; any substitution is detected and rejected by `__check_auth`. The relayer can only manipulate fee-bump wrappers, not the inner auth payload. |
| **Credential ID enumeration** | An attacker enumerates stored credential IDs from localStorage to construct targeted assertions. | Credential IDs are opaque random identifiers. Possessing a credential ID alone is insufficient without the platform authenticator. The ID is not a secret, but it cannot be replayed without user interaction. |
| **Sign-count replay (authenticator clone detection)** | An attacker clones the authenticator and replays an old assertion with a lower sign count. | Smart wallet contracts that track and enforce monotonically increasing sign counts will reject replays. The dashboard surface the `signCount` field in the auth payload so contract developers can implement counter enforcement. |
| **Lost / inaccessible authenticator** | The user loses their device or passkey and is locked out of the smart wallet. | Recovery is a contract-level concern. Users should deploy smart wallets with recovery mechanisms (multisig guardians, social recovery, backup keys). The dashboard surfaces this requirement in the Compatibility & Security Notes panel. |
| **Unsupported browser downgrade** | A user on an unsupported browser silently falls back to an insecure path. | `isPasskeySupported()` is checked before every passkey operation. An incompatibility banner and explicit errors are shown; there is no silent fallback. |
| **Relayer SSRF / injection** | Malicious auth entry XDR causes the relayer to perform unintended actions. | The relayer receives only the unsigned XDR and the auth payload. Auth entry XDR is opaque binary data; the relayer does not interpret it. CSP `connect-src` must include the relayer endpoint. |

### Signing Challenge Integrity

The WebAuthn challenge passed to `navigator.credentials.get()` is derived deterministically as:

```
challenge = SHA-256( network_passphrase || auth_entry_xdr )
```

This means:
1. The authenticator commits to the exact auth entry the contract will verify.
2. The contract can reproduce the same hash on-chain and confirm the user authorised exactly this operation.
3. Changing the network or the auth entry yields a different challenge, preventing cross-network replay.

### CSP Additions Required

When deploying with a passkey relayer, add the relayer domain to `connect-src`:

```
connect-src ... https://*.stellar-passkey-relayer.com
```

See `nginx.conf` and `index.html` for the canonical CSP configuration.

### Security Posture Scoring

Passkey smart wallets score **78 / 100** in the dashboard's session security posture model (`getSessionSecurityPosture`), placing them in the **medium-high** tier — above software browser-extension wallets (60–65) and below Ledger native signing (80).  This reflects the strong hardware-bound key guarantee, offset slightly by reliance on a fee-sponsor relayer as an additional trust dependency.

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
