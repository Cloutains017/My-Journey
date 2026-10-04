import PhotoGallery from "@/components/PhotoGallery";
import type { Photo } from "@/lib/types";

export default function PhotoAlbums({ groups }: { groups: { id: string; title: string; photos: Photo[] }[] }) {
  if (!groups.length) return null;
  return <div>
    {groups.length > 1 && <nav aria-label="照片分组" className="photo-group-nav">
      <p className="mb-2 text-[11px] tracking-wider text-muted">相册分组</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {groups.map(group => <a key={group.id} href={`#${encodeURIComponent(`photo-group-${group.id}`)}`} className="photo-group-link">
          {group.title} <span className="text-muted-soft tabular-nums">{group.photos.length}</span>
        </a>)}
      </div>
    </nav>}
    {groups.map(group => <PhotoGallery key={group.id} id={`photo-group-${group.id}`} title={group.title} photos={group.photos} />)}
  </div>;
}
