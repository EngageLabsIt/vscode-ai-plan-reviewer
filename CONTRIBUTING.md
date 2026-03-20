# Contributing to Plan Reviewer

🇬🇧 [English](CONTRIBUTING.md) | 🇮🇹 [Italiano](CONTRIBUTING.it.md)

Thank you for your interest in contributing! This project is currently in **alpha** and welcomes contributions of all kinds — bug reports, feature requests, documentation improvements, and code changes.

## Ground Rules

- **All contributions must go through a Pull Request.** Direct pushes to `main` are not allowed.
- Every PR requires at least one review from a maintainer before it can be merged.
- Keep PRs focused and small — one logical change per PR makes reviews faster.
- Be respectful and constructive in all discussions.

## Getting Started

1. Fork the repository and create your branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   # or
   git checkout -b fix/my-bug
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Make your changes and validate them:
   ```bash
   npm run compile   # type-check
   npm run lint      # ESLint
   npm run test      # unit tests
   ```
4. Commit using a clear, descriptive message.
5. Push your branch and open a Pull Request against `main`.

## Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<short-description>` | `feat/comment-export` |
| Bug fix | `fix/<short-description>` | `fix/diff-engine-offset` |
| Documentation | `docs/<short-description>` | `docs/update-readme` |
| Chore / tooling | `chore/<short-description>` | `chore/update-deps` |

## Pull Request Checklist

Before submitting a PR, make sure:

- [ ] `npm run compile` passes without errors
- [ ] `npm run lint` reports no new warnings or errors
- [ ] `npm run test` passes
- [ ] The PR description explains **what** changed and **why**
- [ ] Any new public API or behavior is documented

## Reporting Bugs

Open a GitHub Issue with:
- A clear title and description
- Steps to reproduce
- Expected vs actual behavior
- VS Code version, extension version, and OS

## Suggesting Features

Open a GitHub Issue tagged `enhancement` with:
- The problem you're trying to solve
- Your proposed solution or approach
- Any alternatives you considered

## License

By contributing you agree that your contributions will be licensed under the [MIT License](LICENSE).
