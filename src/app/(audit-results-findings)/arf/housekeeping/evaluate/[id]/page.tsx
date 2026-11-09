import { notFound, redirect } from 'next/navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const scheduleId = Number(id);
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(scheduleId) || scheduleId < 1 || scheduleId > 2147483647) notFound();
    redirect('/arf/housekeeping/checker');
}
