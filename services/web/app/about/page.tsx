// No request data is read here, so Next.js renders this page once at build
// time. The HTML ships inside the server image and is the same in every stage.
const builtAt = new Date().toISOString();

export default function AboutPage() {
  return (
    <section className="panel prose">
      <h2>How this is deployed</h2>
      <p>
        One <code>next build</code> produces two Konfidence artifacts. The Node server goes to
        Kubernetes through the Helm deployer. Everything under <code>/_next/static</code> goes to
        object storage through the static content deployer and is served from there.
      </p>
      <p>
        Both artifacts are part of one vector, next to the <code>candidates</code> and{" "}
        <code>interviews</code> services. The vector is promoted from stage to stage without a
        rebuild, so this app contains no stage name, no host name and no vector id.
      </p>
      <ul>
        <li>
          The browser calls <code>/candidates</code> and <code>/interviews</code> on its own origin.
        </li>
        <li>
          The server looks other services up in the deployment results of the vector that received
          the request.
        </li>
        <li>Feature flags come from the vector, not from the build.</li>
      </ul>
      <p className="muted">This page was rendered at build time, {builtAt}.</p>
    </section>
  );
}
