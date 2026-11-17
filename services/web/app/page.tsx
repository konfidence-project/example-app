import os from "node:os";
import { features, routingKey } from "@konfidence/next-adapter/server";
import { ScheduleForm } from "@/components/ScheduleForm";
import { StaticOrigin } from "@/components/StaticOrigin";
import { loadInterviews } from "@/lib/desk";

// Rendered per request on the Node server in Kubernetes. Reading the routing
// key makes the page dynamic, so nothing here is fixed at build time.
export default async function DeskPage() {
  const [key, flags, interviews] = await Promise.all([routingKey(), features(), loadInterviews()]);
  const enabled = (flag: string) => flags[flag] === true;

  return (
    <>
      <section className="panel facts">
        <h2>Who answered this request</h2>
        <dl>
          <div>
            <dt>Vector</dt>
            <dd>{key || <span className="muted">no routing key, not behind Konfidence</span>}</dd>
          </div>
          <div>
            <dt>Build</dt>
            <dd>{process.env.NEXT_DEPLOYMENT_ID || <span className="muted">unversioned</span>}</dd>
          </div>
          <div>
            <dt>Pod</dt>
            <dd>{os.hostname()}</dd>
          </div>
          <div>
            <dt>Features</dt>
            <dd>
              {Object.keys(flags).length === 0 && <span className="muted">none</span>}
              {Object.entries(flags).map(([name, value]) => (
                <span key={name} className={value === true ? "flag on" : "flag"}>
                  {name}
                </span>
              ))}
            </dd>
          </div>
          <div className="wide">
            <dt>Static files</dt>
            <dd>
              <StaticOrigin serverVector={key} />
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h2>Schedule an interview</h2>
        <ScheduleForm
          allowVideo={enabled("allow-video-slots")}
          allowNotes={enabled("enable-candidate-notes")}
        />
      </section>

      <section className="panel">
        <h2>Scheduled interviews</h2>
        {!interviews.ok && <p className="error">Could not load interviews: {interviews.error}</p>}
        {interviews.ok && interviews.data.length === 0 && (
          <p className="muted">Nothing scheduled yet.</p>
        )}
        {interviews.ok && interviews.data.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Candidate</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {interviews.data.map((interview) => (
                <tr key={interview.id}>
                  <td>
                    {new Date(interview.slot_time).toLocaleString("en-GB", { timeZone: "UTC" })} UTC
                  </td>
                  <td>{interview.slot_type}</td>
                  <td>{interview.candidate?.name ?? <span className="muted">unknown</span>}</td>
                  <td>{interview.candidate?.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
