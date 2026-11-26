import { type Interview, listInterviews, loadFlags } from "./data";
import { ScheduleForm } from "./schedule-form";

// Rendered per request on the server: the flags and the interviews come from
// the vector that serves the request, never from the build.
export const dynamic = "force-dynamic";

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });

export default async function Page() {
  const flags = await loadFlags();
  let interviews: Interview[] = [];
  let error = "";
  try {
    interviews = await listInterviews();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <main>
      <h1>Interviews</h1>

      <section>
        <h2>Schedule an interview</h2>
        <ScheduleForm videoSlots={flags.videoSlots} candidateNotes={flags.candidateNotes} />
      </section>

      <section>
        <h2>Scheduled</h2>
        {error && <p className="error">Could not load interviews: {error}</p>}
        {!error && interviews.length === 0 && <p className="muted">Nothing scheduled yet.</p>}
        {interviews.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>Type</th>
                <th>Candidate</th>
                {flags.candidateNotes && <th>Notes</th>}
              </tr>
            </thead>
            <tbody>
              {interviews.map((interview) => (
                <tr key={interview.id}>
                  <td>{formatTime(interview.slot_time)}</td>
                  <td>{interview.slot_type}</td>
                  <td>{interview.candidate?.name ?? <span className="muted">unknown</span>}</td>
                  {flags.candidateNotes && <td>{interview.candidate?.notes ?? ""}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
