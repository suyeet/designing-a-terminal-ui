# Contributing to Relay

Relay is an early terminal product for understanding AI coding activity. Its
current release includes a simulation and a read-only Codex hook connector.
Live event delivery must be verified in the user's trusted local project.

With Node.js 22 or later, run these commands from the repository root:

```sh
npm ci
npm start
npm run check
npm run check:package
```

The package check installs a temporary package, preferring npm's dependency
cache and downloading missing metadata or dependencies when needed. It exercises
the installed `relay` executable, then removes the temporary installation.
It requires network access on a fresh machine and never publishes a package.

For a bug report, include your operating system, Node version, terminal size,
steps to reproduce, expected behavior, and actual behavior. Remove secrets and
private project information from any logs or screenshots.

Keep pull requests focused on one improvement. Explain the behavior change and
how you tested it. Preserve explicit simulation labels and the approval tests.
Do not connect the demo's approval UI directly to arbitrary shell execution.

The project uses the MIT license; see LICENSE.
