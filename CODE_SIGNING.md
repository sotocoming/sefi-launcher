# Code signing policy

## Current status

SEFI Launcher is preparing an application to the
[SignPath Foundation](https://signpath.org/apply) open-source program.
Acceptance and signing integration are pending. Existing releases must not be
represented as SignPath-signed based on this document. Check the actual Windows
signature on each installer and executable.

## Project roles

- Project maintainer, committer and reviewer: [sotocoming](https://github.com/sotocoming).
- Designated signing approver: [sotocoming](https://github.com/sotocoming).
- Other authors are recorded in the [contributor history](https://github.com/sotocoming/sefi-launcher/graphs/contributors).
  Authorship alone does not grant signing approval rights.

Before signing is enabled, the maintainer must configure the corresponding
roles in SignPath and verify multi-factor authentication for everyone with
repository/signing access. This policy does not attest that those account
settings have already been verified.

## Signing procedure

Once accepted and configured, every signing request must originate from the
public source repository's automated GitHub Actions build for a known commit.
The approver must check the source revision, build result and artifacts, and
manually approve each release. Changes from other contributors require review;
build and signing configuration receive the same scrutiny as application code.

Sign only this project's own binaries. Do not apply the project's signature to
Minecraft, Java, third-party mods, libraries or other upstream binaries. Preserve
upstream notices, licenses and signatures when including permitted dependencies.
The project's [MIT license](LICENSE) does not relicense upstream components or
grant rights in third-party trademarks.

The signing configuration must enforce SEFI Launcher product metadata and a
consistent product version for the project's signed binaries in each build.
Do not modify a binary after signing. Verify signatures and timestamps before
publishing the release; link this policy from the download/release page.

## Attribution after activation

After the Foundation accepts the project and signing is operational, the
homepage and download/release page must display the following attribution:

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).

This sentence describes the intended arrangement after activation; it is not a
claim that the current unsigned releases already use that service.

## Privacy and reporting concerns

See the [SEFI Launcher privacy policy](PRIVACY.md) for automatic requests,
account handling, Discord activity, diagnostics, local storage and user controls.
This launcher uses network services; it does not claim to be a program that
never transfers information unless explicitly requested.

Report suspected release or signature problems through the
[repository issue tracker](https://github.com/sotocoming/sefi-launcher/issues).
Ask for a private channel before providing sensitive evidence. Signing concerns
involving the Foundation can also be raised using the contact in its
[terms](https://signpath.org/terms).
