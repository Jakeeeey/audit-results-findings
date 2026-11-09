import { inventoryAuditService } from '../../inventory-audit/services/inventoryAuditService';
import { shortageService } from '../../shortage/inventory/services/shortageService';
import { useSopResource } from './useSopResource';

/** Reuse established ARF lookups; displayed options never confer SOP permissions. */
export function useSopLookups() {
    const resource = useSopResource('sop-lookups', async () => {
        const [branches, users] = await Promise.all([inventoryAuditService.getBranches(), shortageService.getUsers()]);
        return {
            branches: branches.map(branch => ({ value: String(branch.id), label: branch.branch_name })),
            users: users.map(user => ({ value: String(user.user_id), label: `${user.user_fname} ${user.user_lname}`.trim() })),
        };
    });
    return { ...resource, branches: resource.data?.branches ?? [], users: resource.data?.users ?? [] };
}
