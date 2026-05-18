'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface ModuleLinkRecord {
  doc_type?:         string;
  docType?:          string; // Alternative casing from Directus
  link:              string;
  module_identifier: string | null;
}

// Singleton cache so we only fetch once per page session
let _cache: Map<string, string> | null = null;
let _promise: Promise<Map<string, string>> | null = null;

async function loadModuleLinks(): Promise<Map<string, string>> {
  if (_cache) return _cache;
  if (!_promise) {
    _promise = fetch('/api/arf/module-link')
      .then(r => r.json())
      .then((json: { ok: boolean; data?: ModuleLinkRecord[]; error?: string }) => {
        console.log('[useModuleLink] Fetched links:', json.data);
        if (!json.ok) {
          toast.error(`Failed to fetch module links: ${json.error}`);
          return new Map<string, string>();
        }
        const map = new Map<string, string>();
        for (const row of json.data ?? []) {
          const typeKey = row.doc_type || row.docType;
          if (typeKey && row.link) {
            map.set(typeKey.trim().toLowerCase(), row.link);
          }
        }
        _cache = map;
        console.log('[useModuleLink] Map keys:', Array.from(map.keys()));
        // toast.success(`Loaded ${map.size} module links`);
        return map;
      })
      .catch(() => {
        _promise = null; // allow retry on next mount
        return new Map<string, string>();
      });
  }
  return _promise;
}

export function useModuleLink() {
  const [linkMap, setLinkMap] = useState<Map<string, string>>(_cache ?? new Map());

  useEffect(() => {
    if (!_cache) {
      loadModuleLinks().then(setLinkMap);
    }
  }, []);

  /** Returns the link for a given doc type, or null if not found */
  const getLinkForDocType = useCallback(
    (docType: string): string | null =>
      linkMap.get(docType.trim().toLowerCase()) ?? null,
    [linkMap]
  );

  /** Opens the module link for the doc type in a new tab, appending the docNo */
  const openDocLink = useCallback(
    (docType: string, docNo: string) => {
      const link = getLinkForDocType(docType);
      console.log(`[useModuleLink] Opening link for ${docType}:`, link);
      if (link) {
        // If the link is a base URL, we might need to append the docNo.
        // For now, we'll just open the link as is, but we could do more logic here.
        // If the link ends with / or =, we append. Otherwise just open.
        let finalUrl = link;
        if (link.includes('{docNo}')) {
          finalUrl = link.replace('{docNo}', encodeURIComponent(docNo));
        } else if (link.endsWith('/') || link.endsWith('=')) {
          finalUrl = link + encodeURIComponent(docNo);
        }
        window.open(finalUrl, '_blank', 'noopener,noreferrer');
      } else {
        console.warn(`[useModuleLink] No link found for docType: "${docType}"`);
      }
    },
    [getLinkForDocType]
  );

  return { getLinkForDocType, openDocLink, linkMap };
}
