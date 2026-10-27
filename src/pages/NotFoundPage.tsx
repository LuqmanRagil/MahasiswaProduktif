import { Link } from "react-router";
import { Compass } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";

export function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        icon={<Compass />}
        title="Halaman tidak ditemukan"
        description="Link ini mungkin salah ketik atau halamannya sudah dipindah."
        action={
          <Link to="/" className="text-sm font-semibold text-primary hover:underline">
            Kembali ke Dashboard
          </Link>
        }
      />
    </Card>
  );
}
