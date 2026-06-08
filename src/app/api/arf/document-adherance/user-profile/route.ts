import { NextRequest, NextResponse } from "next/server"; // Updated for robust profile resolution

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userName = searchParams.get("name");

    if (!userName) {
        return NextResponse.json({ ok: false, message: "User name is required" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    const staticToken = process.env.DIRECTUS_STATIC_TOKEN;

    try {
        const parts = userName.trim().split(/\s+/);
        const first = parts[0];

        // Try a very simple search first
        let searchRes = await fetch(`${baseUrl}/items/user?search=${encodeURIComponent(userName.replace(/\s+/g, ' '))}&limit=5`, {
            headers: { "Authorization": `Bearer ${staticToken}` },
            next: { revalidate: 0 }
        });

        let searchJson = await searchRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let searchResult = searchJson.data?.find((u: any) => {
            const f = (u.user_fname || "").toLowerCase();
            const l = (u.user_lname || "").toLowerCase();
            const target = userName.toLowerCase();
            return target.includes(f) && target.includes(l);
        }) || searchJson.data?.[0];

        if (!searchResult && first) {
            searchRes = await fetch(`${baseUrl}/items/user?search=${encodeURIComponent(first)}&limit=10`, {
                headers: { "Authorization": `Bearer ${staticToken}` },
                next: { revalidate: 0 }
            });
            searchJson = await searchRes.json();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            searchResult = searchJson.data?.find((u: any) => {
                const f = (u.user_fname || "").toLowerCase();
                const l = (u.user_lname || "").toLowerCase();
                const target = userName.toLowerCase();
                return target.includes(f) && target.includes(l);
            });
        }

        if (!searchResult) {
            console.log(`[User Profile API] No user found for search: ${userName}`);
            return NextResponse.json({ ok: false, message: "User not found" }, { status: 404 });
        }

        // Now we have the user ID, fetch full details like my-profile does (which works)
        const fullRes = await fetch(`${baseUrl}/items/user/${searchResult.user_id || searchResult.id}?fields=*,user_department.*`, {
            headers: { "Authorization": `Bearer ${staticToken}` },
            next: { revalidate: 0 }
        });

        if (!fullRes.ok) {
            console.error(`[User Profile API] Full fetch failed: ${fullRes.status}`);
            throw new Error(`Directus error: ${fullRes.status}`);
        }

        const fullJson = await fullRes.json();
        const userObj = fullJson.data;

        const finalUser = userObj;
        if (!finalUser) {
            console.log(`[User Profile API] No user found for name: ${userName}`);
            return NextResponse.json({ ok: false, message: "User not found" }, { status: 404 });
        }

        console.log(`[User Profile API] Raw data for ${userName}:`, JSON.stringify(finalUser));

        // Robust name resolution
        const firstName = finalUser.user_fname || finalUser.first_name || finalUser.FirstName || finalUser.firstName || "";
        const lastName = finalUser.user_lname || finalUser.last_name || finalUser.LastName || finalUser.lastName || "";
        const fullName = `${firstName} ${lastName}`.trim() || finalUser.display_name || finalUser.name || finalUser.email?.split('@')[0];

        // Robust position resolution
        const position = finalUser.user_position || finalUser.position || finalUser.role || finalUser.job_title || "Staff / Personnel";

        // Robust department resolution
        let department = "Operations Department";
        if (finalUser.user_department && typeof finalUser.user_department === 'object') {
            department = finalUser.user_department.department_name || finalUser.user_department.name || "Operations Department";
        } else if (finalUser.user_department) {
            // Fetch explicitly if it's an ID
            try {
                const deptRes = await fetch(`${baseUrl}/items/department/${finalUser.user_department}?fields=department_name`, {
                    headers: { "Authorization": `Bearer ${staticToken}` }
                });
                if (deptRes.ok) {
                    const deptData = await deptRes.json();
                    department = deptData.data?.department_name || `Dept ID: ${finalUser.user_department}`;
                } else {
                    department = `Dept ID: ${finalUser.user_department}`;
                }
            } catch {
                console.warn("[User Profile API] Failed to fetch department name for ID", finalUser.user_department);
                department = `Dept ID: ${finalUser.user_department}`;
            }
        }

        console.log(`[User Profile API] Resolved: ${fullName}, ${position}, ${department}`);

        return NextResponse.json({
            ok: true,
            data: {
                id: finalUser.user_id || finalUser.id,
                name: fullName,
                position: position,
                department: department
            }
        });
    } catch (error) {
        console.error("[User Profile API] Error:", error);
        return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
    }
}

// Fixed duplicate name u by using finalUser and searchResult
// Re-build triggered successfully.
