import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "vos_access_token";

function decodeJwt(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        let s = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        while (s.length % 4) s += "=";
        const json = Buffer.from(s, "base64").toString("utf8");
        return JSON.parse(json);
    } catch {
        return null;
    }
}

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
        return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const payload = decodeJwt(token);
    const userId = payload?.id || payload?.user_id || payload?.sub;

    if (!userId) {
        return NextResponse.json({ ok: false, message: "Invalid session" }, { status: 401 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    const staticToken = process.env.DIRECTUS_STATIC_TOKEN;

    try {
        // Fetch full user details with wide field selection for robustness
        const response = await fetch(`${baseUrl}/items/user/${userId}?fields=*,user_department.*`, {
            headers: { "Authorization": `Bearer ${staticToken}` },
            next: { revalidate: 0 }
        });

        if (!response.ok) {
            throw new Error(`Directus error: ${response.status}`);
        }

        const result = await response.json();
        const u = result.data || {};
        console.log(`[My Profile API] Raw user data for ID ${userId}:`, JSON.stringify(u));

        // Robust name resolution
        const firstName = u.user_fname || u.first_name || u.FirstName || u.firstName || "";
        const lastName = u.user_lname || u.last_name || u.LastName || u.lastName || "";
        const fullName = `${firstName} ${lastName}`.trim() || u.display_name || u.name || u.email?.split('@')[0] || "Audit Compliance Team";

        // Robust position resolution
        const position = u.user_position || u.position || u.role || u.job_title || "Auditor";

        // Robust department resolution
        let department = "Audit Department";
        if (u.user_department && typeof u.user_department === 'object') {
            department = u.user_department.department_name || u.user_department.name || "Audit Department";
        } else if (u.user_department) {
            // It's an ID, fetch the department name explicitly
            try {
                const deptRes = await fetch(`${baseUrl}/items/department/${u.user_department}?fields=department_name`, {
                    headers: { "Authorization": `Bearer ${staticToken}` }
                });
                if (deptRes.ok) {
                    const deptData = await deptRes.json();
                    department = deptData.data?.department_name || `Dept ID: ${u.user_department}`;
                } else {
                    department = `Dept ID: ${u.user_department}`;
                }
            } catch {
                console.warn("[My Profile API] Failed to fetch department name for ID", u.user_department);
                department = `Dept ID: ${u.user_department}`;
            }
        }

        console.log(`[My Profile API] Resolved: ${fullName}, ${position}, ${department}`);

        return NextResponse.json({
            ok: true,
            data: {
                name: fullName,
                position: position,
                department: department
            }
        });
    } catch (error) {
        console.error("[My Profile API] Error:", error);
        return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
    }
}
