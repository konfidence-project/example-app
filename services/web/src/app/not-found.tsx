import { PageBody, PageHeader } from "@/components/layouts/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { paths } from "@/config/paths";

export default function NotFound() {
  return (
    <>
      <PageHeader title="Not found" />
      <PageBody>
        <EmptyState title="This page does not exist">
          <ButtonLink href={paths.schedule.href}>Go to the schedule</ButtonLink>
        </EmptyState>
      </PageBody>
    </>
  );
}
