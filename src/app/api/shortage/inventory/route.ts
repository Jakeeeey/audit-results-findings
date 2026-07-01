import { NextRequest, NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const fetchHeaders = {
    "Authorization": `Bearer ${STATIC_TOKEN}`,
    "Content-Type": "application/json",
};

export async function GET(req: NextRequest) {
    const action = req.nextUrl.searchParams.get("action");

    if (action === "users") {
        try {
            const url = `${DIRECTUS_URL}/items/user?limit=1000&fields=user_id,user_fname,user_lname,user_email&sort=user_fname`;
            const res = await fetch(url, { headers: fetchHeaders });
            const result = await res.json();
            return NextResponse.json(result);
        } catch (error) {
            console.error("Failed to fetch users", error);
            return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
        }
    }

    if (action === "list") {
        try {
            const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
            const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");
            const search = req.nextUrl.searchParams.get("search") || "";

            let url = `${DIRECTUS_URL}/items/nod_inventory_shortage?page=${page}&limit=${limit}&meta=total_count&sort=-created_at&fields=*,receiver_id.*,issuer_id.*,manager_id.*`;

            if (search) {
                // simple search on nte_number
                const filter = encodeURIComponent(JSON.stringify({
                    nte_number: { _icontains: search }
                }));
                url += `&filter=${filter}`;
            }

            const res = await fetch(url, { headers: fetchHeaders });
            const result = await res.json();

            return NextResponse.json(result);
        } catch (error) {
            console.error("Failed to fetch shortages", error);
            return NextResponse.json({ error: "Failed to fetch shortages" }, { status: 500 });
        }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const p = parts[1];
        const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        const json = Buffer.from(padded, "base64").toString("utf8");
        return JSON.parse(json);
    } catch {
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const dataStr = formData.get("data") as string;
        
        if (!dataStr) {
            return NextResponse.json({ error: "Missing data" }, { status: 400 });
        }
        
        const body = JSON.parse(dataStr);
        const files = formData.getAll("files") as File[];
        
        const token = req.cookies.get("vos_access_token")?.value;
        if (token) {
            const payload = decodeJwtPayload(token);
            if (payload) {
                // Try to find the user ID in the token payload
                const userId = payload.id || payload.employee_id || payload.user_id || payload.sub;
                if (userId) {
                    body.issuer_id = userId;
                }
            }
        }

        const res = await fetch(`${DIRECTUS_URL}/items/nod_inventory_shortage`, {
            method: "POST",
            headers: fetchHeaders,
            body: JSON.stringify(body)
        });
        
        const result = await res.json();
        
        if (!res.ok) {
            return NextResponse.json({ error: result.errors?.[0]?.message || "Failed to create" }, { status: res.status });
        }
        
        const shortageId = result.data?.id;

        // Handle file uploads if any
        if (shortageId && files && files.length > 0) {
            for (const file of files) {
                try {
                    const fileData = new FormData();
                    fileData.append("file", file);
                    
                    const uploadRes = await fetch(`${DIRECTUS_URL}/files`, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${STATIC_TOKEN}`
                            // DO NOT set Content-Type, fetch will set it with the correct boundary
                        },
                        body: fileData
                    });
                    
                    if (uploadRes.ok) {
                        const uploadData = await uploadRes.json();
                        const directusFileId = uploadData.data?.id;
                        
                        if (directusFileId) {
                            // Create attachment record in the custom table
                            await fetch(`${DIRECTUS_URL}/items/nod_inventory_shortage_attachment`, {
                                method: "POST",
                                headers: fetchHeaders,
                                body: JSON.stringify({
                                    nod_id: shortageId,
                                    file_name: file.name,
                                    file_type: file.type || "application/octet-stream",
                                    file_size_bytes: file.size,
                                    file_path: directusFileId
                                })
                            });
                        }
                    } else {
                        console.error("Failed to upload file to Directus:", await uploadRes.text());
                    }
                } catch (err) {
                    console.error("Error uploading file:", err);
                }
            }
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("Failed to create record", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
