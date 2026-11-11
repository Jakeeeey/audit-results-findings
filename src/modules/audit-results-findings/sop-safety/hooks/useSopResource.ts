import { useCallback, useEffect, useRef, useState } from 'react';

/** Abort superseded reads; never retry mutations or silently convert errors to []. */
export function useSopResource<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>) {
    const loader = useRef(fetcher);
    useEffect(() => { loader.current = fetcher; });
    const [revision, setRevision] = useState(0);
    const [state, setState] = useState<{ key: string; revision: number; data?: T; error?: unknown }>();
    const reload = useCallback(() => setRevision(value => value + 1), []);
    useEffect(() => {
        const controller = new AbortController();
        loader.current(controller.signal).then(data => {
            if (!controller.signal.aborted) setState({ key, revision, data });
        }).catch((error: unknown) => {
            if (!controller.signal.aborted) setState({ key, revision, error });
        });
        return () => controller.abort();
    }, [key, revision]);
    const current = state?.key === key && state.revision === revision ? state : undefined;
    return { data: current?.data, error: current?.error, loading: current === undefined, reload };
}
