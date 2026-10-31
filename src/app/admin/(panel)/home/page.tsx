import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EntitySection, entityTitle } from "@/components/admin/EntitySection";

export const metadata = { title: "Home page" };

export default function HomeContentPage() {
  const banners = entityTitle("banners");
  const testimonials = entityTitle("testimonials");
  return (
    <>
      <AdminPageHeader title="Home page" description="The banners and customer words shown on the front page. Featured products are chosen on each product." />
      <div className="space-y-12">
        <div>
          <h2 className="mb-1 !text-3xl">{banners.title}</h2>
          <p className="mb-4 text-sm text-ink/70">{banners.description}</p>
          <EntitySection entityKey="banners" />
        </div>
        <div>
          <h2 className="mb-1 !text-3xl">{testimonials.title}</h2>
          <p className="mb-4 text-sm text-ink/70">{testimonials.description}</p>
          <EntitySection entityKey="testimonials" />
        </div>
      </div>
    </>
  );
}
