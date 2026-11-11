/** Compatibility response only: historical evaluations are no longer writable. */
export async function retiredEvaluationWrite() {
    return Response.json({ error: { code: 'ARCHIVE_READ_ONLY', message: 'Historical inspections are read-only. Create or edit audits in the Housekeeping Auditor.' } }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
