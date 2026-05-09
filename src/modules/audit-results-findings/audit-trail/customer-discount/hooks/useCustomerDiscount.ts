"use client";

/**
 * useCustomerDiscount.ts
 * ──────────────────────
 * Centralises:
 *  • Data fetching via fetchCustomerDiscountLogs (provider)
 *  • UI state: filters, loading flag, rows, pagination
 *  • Exposes a clean API back to CustomerDiscountModule
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import type { CustomerDiscountFilters, CustomerDiscountRow } from "../types";
import { fetchCustomerDiscountLogs } from "../providers/fetchProviders";
import { buildDefaultFilters, rowMatchesSearch } from "../utils/customerDiscountUtils";

const PAGE_SIZE = 15;

export function useCustomerDiscount() {
    // ── Filters ─────────────────────────────────────────────────────────────
    const [filters, setFilters] = useState<CustomerDiscountFilters>(
        buildDefaultFilters,
    );

    // ── Data ────────────────────────────────────────────────────────────────
    const [rows, setRows] = useState<CustomerDiscountRow[]>([]);
    const [loading, setLoading] = useState(false);

    // ── Pagination ──────────────────────────────────────────────────────────
    const [page, setPage] = useState(1);

    // ── Debounce ref for search ──────────────────────────────────────────────
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Fetch ────────────────────────────────────────────────────────────────
    const fetchData = useCallback(async (f: CustomerDiscountFilters) => {
        setLoading(true);
        try {
            const { rows: fetched, error } = await fetchCustomerDiscountLogs(f);
            if (error) {
                toast.error(error);
                setRows([]);
            } else {
                setRows(fetched);
                setPage(1); // reset to first page on new data
            }
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Auto-fetch when filters change (debounce search field only) ──────────
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            void fetchData(filters);
        }, 400);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        filters.startDate,
        filters.endDate,
        filters.search,
    ]);

    // ── Filter setters (granular, keep existing shape) ──────────────────────
    const setFilterField = useCallback(
        <K extends keyof CustomerDiscountFilters>(
            key: K,
            value: CustomerDiscountFilters[K],
        ) => {
            setFilters((prev) => ({ ...prev, [key]: value }));
        },
        [],
    );

    const resetFilters = useCallback(() => {
        setFilters(buildDefaultFilters());
    }, []);

    // ── Pagination helpers ──────────────────────────────────────────────────
    // Apply client-side search across customerName, storeName, categoryName,
    // changedBy, and all other text fields via rowMatchesSearch
    const filteredRows = filters.search?.trim()
        ? rows.filter((r) => rowMatchesSearch(r, filters.search))
        : rows;

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);

    const paginatedRows = filteredRows.slice(
        (safePage - 1) * PAGE_SIZE,
        safePage * PAGE_SIZE,
    );

    return {
        // data
        rows,
        paginatedRows,
        loading,

        // filters
        filters,
        setFilterField,
        resetFilters,

        // pagination
        page: safePage,
        totalPages,
        totalCount: filteredRows.length,
        pageSize: PAGE_SIZE,
        setPage,

        // manual refresh
        refresh: () => fetchData(filters),
    };
}
