<!--
	Sync Impact Report
	- Version change: unspecified -> 1.0.0
	- Modified principles: placeholder template -> Code Quality; User Experience Consistency; Performance & Efficiency
	- Added sections: Development Workflow aligned with 'no CI/tests' preference
	- Removed/De-emphasized: Test-first/mandatory CI requirement from templates
	- Templates updated: .specify/templates/spec-template.md ✅, .specify/templates/plan-template.md ✅,
											.specify/templates/tasks-template.md ✅, .specify/templates/checklist-template.md ✅,
											.specify/templates/agent-file-template.md ✅
	- Follow-up TODOs: RATIFICATION_DATE left as TODO
-->

# Rogue Constitution

## Core Principles

### I. Code Quality (NON-NEGOTIABLE)
All code delivered to the repository MUST be readable, maintainable, and unambiguous.
- **Style & Readability**: Code MUST follow the project's established style guide or a documented
	language-specific style (formatters and linters are RECOMMENDED). Code MUST include clear names
	and small, focused functions/modules.
- **Review & Pairing**: All changes MUST be peer-reviewed before merging. Reviews MUST verify
	conformance to the style guide, absence of obvious correctness bugs, and reasonable complexity.
- **Static Analysis**: Use of static analysis and lightweight linters is REQUIRED where available.
	Results SHOULD be reviewed and addressed before merging. Static analysis is preferred over
	heavyweight test gating when rapid iteration is needed.

Rationale: High code quality reduces maintenance cost, speeds onboarding, and prevents technical
debt accumulation while allowing fast iteration without mandatory CI/test gating.

### II. User Experience Consistency (MUST)
UX must be consistent across all user-facing surfaces (CLI, API, UI). Consistency includes visual
language, error semantics, and interaction patterns.
- **Design Tokens & Patterns**: Adopt and document a minimal set of design tokens or interaction
	primitives that implementations MUST follow.
- **Errors & Messaging**: Error messages MUST be actionable and user-focused. APIs/CLI MUST return
	consistent status and error shapes that are documented in the spec for each feature.
- **Accessibility & Clarity**: Public interfaces MUST be accessible and predictable; accessibility
	issues that fundamentally block usage are NOT acceptable.

Rationale: A consistent UX reduces support burden, increases predictability for integrators and end
users, and shortens feedback cycles during fast development.

### III. Performance & Efficiency (MUST)
Every feature MUST declare measurable performance goals in its spec: target latency percentiles,
throughput, and resource budgets (memory/disk). Performance goals are non-negotiable acceptance
criteria for feature completion.
- **Measurable Targets**: Include explicit metrics, e.g., "p95 < 200ms under X workload" or
	"memory < 100MB RSS for process Y". Goals MUST use clear units and testable thresholds.
- **Performance Budgeting**: Features MUST include a performance budget and explain how regression
	will be detected and mitigated during development.
- **Profiling & Optimization**: Developers MUST profile when approaching budgets and document
	optimizations and trade-offs in the feature plan.

Rationale: Declared and measurable performance expectations ensure the app remains usable at scale
and guide pragmatic optimization efforts during rapid development.

## Constraints & Development Expectations

- **No Mandatory Tests/CI**: Tests and CI/CD workflows are OPTIONAL for this project by design to
	enable faster iteration. Where tests are used, they MUST be documented in the feature spec and
	understood as developer-maintained artifacts rather than governance blockers.
- **Minimum Tooling**: Projects SHOULD use linters and formatters to preserve readability; heavy
	CI enforcement is NOT required.
- **Documentation**: Each feature MUST include a short `quickstart.md` describing manual verification
	and any required runtime steps for reviewers and testers.
- **Small, Focused Changes**: Pull requests SHOULD be small and focused; large refactors MUST include
	an implementation plan and staged migration approach.

## Development Workflow

- **Branching & PRs**: Use short-lived branches. PRs MUST include a short summary of behavior changes,
	performance implications, and a manual verification checklist.
- **Manual Smoke Validation**: Before merging, the author MUST perform and document a quick manual
	smoke validation (steps in `quickstart.md`). Automated CI is optional but acceptable if set up.
- **Release Notes & Rollback**: Releases MUST include a short note on performance impact and
	behavioral changes. Rollback steps MUST be documented for risky changes.

## Governance

- **Amendments**: Amendments to this constitution MUST be proposed in a PR titled "amend: constitution"
	and include a rationale, migration plan (if applicable), and a simple approval record (at least
	two maintainers' sign-off). Minor wording edits that do not change intent MAY be accepted with a
	single maintainer approval.
- **Versioning Policy**:
	- **MAJOR** version when a principle is removed or its intent is redefined (breaking governance).
	- **MINOR** version when a new principle or mandatory section is added.
	- **PATCH** version for clarifications, typos, or non-substantive rewording.
- **Compliance Reviews**: Feature specs MUST include a short "Constitution Check" section documenting
	how the feature meets: Code Quality, UX Consistency, and Performance. Maintainters MAY request
	additional justification for exceptions.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE) | **Last Amended**: 2025-11-16
