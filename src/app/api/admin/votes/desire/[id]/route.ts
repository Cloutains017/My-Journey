import { archiveDelete } from '@/lib/admin-recycle';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return archiveDelete(request, 'desire_votes', (await params).id);
}
