# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Subscription Management System**:
  - Implemented subscription lifecycle management (create, renew, cancel, upgrade).
  - Added payment integration with mocked providers (Alipay, WeChat, Stripe).
  - Created order management system with status tracking.
  - Added new database models: `Subscription`, `Plan`, `Order`, `PaymentCallback`.
  - Added comprehensive API documentation in `docs/api/subscriptions` and `docs/api/orders`.
  - Added test scripts: `scripts/test-subscriptions-api.js` and `scripts/test-orders-api.js`.

### Changed
- Downgraded Prisma to v5.22.0 to resolve compatibility issues.
- Updated `.env.example` with new payment configuration variables.

### Fixed
- Resolved `simulate-pay` route environment check logic.
