import 'server-only';
import { secureEndpoint } from './security';
import { z } from 'zod';
import { evaluationToken } from './configuration';

/**
 * The migration stamps this marker only after installing all write guards.
 *
 * Accepted risk (2026-11-05): anonymous Public access to the evaluation
 * collections is intentionally NOT a gate here. It was requested that the
 * feature match the other modules rather than block on that pre-existing
 * permission configuration. The database guards and the server-side BFF
 * remain the enforcement points; Directus permissions were not changed.
 */
export async function saveReadiness(): Promise<boolean> {
    if (!evaluationToken()) return false;
    try {
        const url = secureEndpoint(process.env.NEXT_PUBLIC_API_BASE_URL, 'collections/arf_evaluation_schedule_guards');
        const response = await fetch(url, { headers: { Authorization: `Bearer ${evaluationToken()}` }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error('Setup inspection unavailable');
        const marker = z.object({ data: z.object({ schema: z.object({ comment: z.enum(['ARF_SAVE_V2_OPEN_EVALUATOR', 'ARF_SAVE_V3_SUBMIT']) }) }) });
        marker.parse(await response.json());
        return true;
    } catch { return false; }
}

export async function submissionReadiness(): Promise<boolean> {
    if (!await saveReadiness()) return false;
    try {
        const response = await fetch(secureEndpoint(process.env.NEXT_PUBLIC_API_BASE_URL, 'collections/arf_evaluation_schedule_guards'), {
            headers: { Authorization: `Bearer ${evaluationToken()}` }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(5000),
        });
        return response.ok && z.object({ data: z.object({ schema: z.object({ comment: z.literal('ARF_SAVE_V3_SUBMIT') }) }) }).safeParse(await response.json()).success;
    } catch { return false; }
}

export async function weeklyReadiness(): Promise<boolean> {
    if (!await saveReadiness()) return false;
    try {
        const base = process.env.NEXT_PUBLIC_API_BASE_URL;
        const options = { headers: { Authorization: `Bearer ${evaluationToken()}` }, redirect: 'error' as const, cache: 'no-store' as const, signal: AbortSignal.timeout(5000) };
        const metadata = await fetch(secureEndpoint(base, 'collections/arf_evaluation_weekly_state'), options);
        const marker = z.object({ data: z.object({ schema: z.object({ comment: z.literal('ARF_WEEKLY_V1_INSTALLED') }) }) });
        if (!metadata.ok || !marker.safeParse(await metadata.json()).success) return false;
        const response = await fetch(secureEndpoint(base, 'items/arf_evaluation_weekly_state/0?fields=heartbeat'), options);
        if (!response.ok) return false;
        const body = z.object({ data: z.object({ heartbeat: z.string() }) }).parse(await response.json());
        const heartbeat = Date.parse(body.data.heartbeat.replace(' ', 'T').replace(/Z?$/, 'Z'));
        const age = Date.now() - heartbeat;
        return Number.isFinite(age) && age >= -60000 && age < 300000;
    } catch { return false; }
}
