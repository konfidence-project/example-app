import { PageBody, PageHeader } from "@/components/layouts/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { paths } from "@/config/paths";

export default function CandidateNotFound() {
  return (
    <>
      <PageHeader title="Candidate not found" />
      <PageBody>
        <EmptyState title="There is no candidate with this ID">
          <ButtonLink href={paths.people.href}>Back to people</ButtonLink>
        </EmptyState>
      </PageBody>
    </>
  );
}
