import Link from "next/link";
import { toProtectedUploadSrc } from "@/lib/storage/condo-upload-path";

interface AnnouncementAttachmentLinkProps {
  url: string;
  name?: string | null;
}

export function AnnouncementAttachmentLink({ url, name }: AnnouncementAttachmentLinkProps) {
  return (
    <p>
      <Link
        href={toProtectedUploadSrc(url)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        {name ? `Anexo: ${name}` : "Abrir anexo"}
      </Link>
    </p>
  );
}
