import 'server-only';

/** Same server credential convention as the other ARF modules. */
export function evaluationToken(): string | undefined {
    return process.env.DIRECTUS_STATIC_TOKEN;
}
