"use client";

/**
 * usePriceChange.ts
 * ─────────────────
 * Centralises:
 *  • Data fetching via fetchPriceChangeRequests (provider)
 *  • UI state: filters, loading flag, rows, pagination
 *  • Exposes a clean API back to PriceChangeModule
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";

import type { PriceChangeFilters, PriceChangeRow } from "../types";
import { fetchPriceChangeRequests } from "../providers/fetchproviders";
import { buildDefaultFilters, rowMatchesSearch } from "../utils/priceChangeUtils";

const PAGE_SIZE = 15;

export function usePriceChange() {
    // ── Filters ─────────────────────────────────────────────────────────────
    const [filters, setFilters] = useState<PriceChangeFilters>(
        buildDefaultFilters,
    );

    // ── Data ────────────────────────────────────────────────────────────────
    const [rows, setRows] = useState<PriceChangeRow[]>([]);
    const [loading, setLoading] = useState(false);

    // ── Pagination ──────────────────────────────────────────────────────────
    const [page, setPage] = useState(1);

    // ── Debounce ref for search ──────────────────────────────────────────────
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Fetch ────────────────────────────────────────────────────────────────
    const fetchData = useCallback(async (f: PriceChangeFilters) => {
        setLoading(true);
        try {
            const { rows: fetched, error } = await fetchPriceChangeRequests(f);
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

    // ── Auto-fetch only when API-backed filters change ───────────────────────
    // search is handled client-side — no re-fetch needed for it
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
        filters.status,
        filters.priceTypeName,
    ]);

    // ── Filter setters (granular, keep existing shape) ──────────────────────
    const setFilterField = useCallback(
        <K extends keyof PriceChangeFilters>(
            key: K,
            value: PriceChangeFilters[K],
        ) => {
            setFilters((prev) => ({ ...prev, [key]: value }));
        },
        [],
    );

    const resetFilters = useCallback(() => {
        setFilters(buildDefaultFilters());
    }, []);

    // ── Client-side search filter ─────────────────────────────────────────────
    // Runs instantly on every keystroke — no network call
    const filteredRows = useMemo(() => {
        if (!filters.search.trim()) return rows;
        return rows.filter((r) => rowMatchesSearch(r, filters.search));
    }, [rows, filters.search]);

    // ── Pagination helpers ──────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);

    const paginatedRows = filteredRows.slice(
        (safePage - 1) * PAGE_SIZE,
        safePage * PAGE_SIZE,
    );

    // Reset to page 1 when search changes
    useEffect(() => {
        setPage(1);
    }, [filters.search]);

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
