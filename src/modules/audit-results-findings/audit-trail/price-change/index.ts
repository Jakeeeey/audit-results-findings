/**
 * index.ts — Public surface for the price-change audit-trail module.
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
export type { PriceChangeRow, PriceChangeFilters, PriceChangeStatus } from "./types";

// Module entry — the only component the host page needs
export { default as PriceChangeModule } from "./PriceChangeModule";
