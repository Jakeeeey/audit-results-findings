import { useCallback, useEffect, useState } from 'react';
import { sopSafetyService } from '../services/sopSafetyService';
import type { SopChecklistDetail } from '../types';

export function useChecklistDetail(id: number | null) {
    const [state, setState] = useState<{ id: number; result?: SopChecklistDetail; error?: string } | null>(null);
    const [revision, setRevision] = useState(0);
    const retry = useCallback(() => setRevision(value => value + 1), []);

    useEffect(() => {
        if (id === null) return;
        const controller = new AbortController();
        sopSafetyService.getChecklist(id, controller.signal).then(result => {
            if (!controller.signal.aborted) setState({ id, result });
        }).catch((cause: unknown) => {
            if (!controller.signal.aborted) setState({ id, error: cause instanceof Error ? cause.message : 'Unable to load checklist detail.' });
        });
        return () => controller.abort();
    }, [id, revision]);

    const current = state?.id === id ? state : null;
    return { result: current?.result, error: current?.error, loading: id !== null && current === null, retry: () => { setState(null); retry(); } };
}
