import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { parseSop, sopRequest, SopApiError, SopContractError } from '../services/sopClient';
import { auditDetailSchema, type SopAuditDetail } from '../schemas/response.schema';
import type { CreateSopAuditInput } from '../schemas/audit.schema';

export function useCreateSopAudit() {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [uncertain, setUncertain] = useState(false);
    const [result, setResult] = useState<SopAuditDetail>();
    const busy = useRef(false);

    async function create(input: CreateSopAuditInput) {
        if (busy.current || uncertain || result !== undefined) return;
        busy.current = true;
        setSaving(true);
        setError('');
        try {
            const response = parseSop(auditDetailSchema, await sopRequest('audits', { method: 'POST', body: input }));
            // Success is reported only after an upstream success response, not optimistically.
            setResult(response);
            toast.success('Backend confirmed audit creation.');
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : 'Unable to create audit.';
            setError(message);
            setUncertain(cause instanceof SopApiError && cause.uncertain || cause instanceof SopContractError);
            toast.error(message);
        } finally { busy.current = false; setSaving(false); }
    }

    return { create, saving, error, uncertain, result };
}
