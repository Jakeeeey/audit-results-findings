import { useCallback, useEffect, useRef, useState } from 'react';
import { sopSafetyService } from '../services/sopSafetyService';
import type { SopChecklist } from '../types';

export function useSopSafety() {
    const [checklists, setChecklists] = useState<SopChecklist[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const request = useRef<AbortController | null>(null);

    const fetchChecklists = useCallback(async () => {
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        setLoading(true);
        setError('');
        try {
            const rows = await sopSafetyService.getChecklists(controller.signal);
            if (!controller.signal.aborted) setChecklists(rows);
        } catch (cause) {
            if (!controller.signal.aborted) {
                setChecklists([]);
                setError(cause instanceof Error ? cause.message : 'Unable to load SOP checklists.');
            }
        } finally { if (!controller.signal.aborted) setLoading(false); }
    }, []);

    useEffect(() => {
        void fetchChecklists();
        return () => request.current?.abort();
    }, [fetchChecklists]);

    return { checklists, error, loading, fetchChecklists };
}
