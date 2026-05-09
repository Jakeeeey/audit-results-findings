/**
 * index.ts — Public surface for the customer-discount audit-trail module.
 *
 * Only what other parts of the app are allowed to import:
 *  - Domain types
 *  - Module entry component
 *
 * Internal implementation (hook, providers, utils, sub-components)
 * must be imported directly from their own paths when needed inside
 * this module, but are NOT re-exported here to keep the public
 * contract tight.
 */

// Types — consumed by the page.tsx that mounts this module
export type { CustomerDiscountRow, CustomerDiscountFilters } from "./types";

// Module entry — the only component the host page needs
export { default as CustomerDiscountModule } from "./CustomerDiscountModule";
