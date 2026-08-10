# Plain-HTTP local registry — blockers & workarounds

Status: **does not work end to end.** A plain-HTTP local registry gets blocked at
publish time and cannot be worked around without losing digests, which Konfidence
requires. The working local variant uses TLS (branch `local-registry-tls`).

## The one hard blocker (publish → deploy cascade)

1. **`ocm add` computes resource digests over HTTPS only.**
   For every `access.type: ociArtifact` resource, `ocm add` issues a `HEAD`
   against the `imageReference` to record its digest. The `imageReference` in the
   component-constructor is a bare docker ref (`kind-registry:5000/...`, no
   scheme), and the OCM CLI (0.3.0-rc.3) defaults to **HTTPS** for any named host.
   `--repository oci::http://...` only sets the *push* target, not the digest
   resolver; the credential-identity `scheme: http` only affects auth, not the
   digest path. Result:

   ```
   error processing resource "candidates-kustomization" with digest processor:
   Head "https://kind-registry:5000/v2/.../manifests/v0.1.0":
   http: server gave HTTP response to HTTPS client
   ```

   There is no plain-HTTP switch for the digest path in this CLI version.

2. **Workaround `--skip-reference-digest-processing` just moves the failure.**
   Publishing then succeeds, but the descriptor has no resource digests, and
   Konfidence rejects it during reconcile:

   ```
   unable to generate digest for ocm descriptor, descriptor is not safely
   digestible: missing digest in resource for interviews-chart:v0.1.0
   ```

   So the VectorTemplate never becomes Ready. Dead end.

**TLS sidesteps this**: the digest `HEAD` succeeds over HTTPS, digests are
recorded, Konfidence accepts the descriptor. That is why the working path is TLS.

## Everything else about HTTP DOES have a clean workaround

These are not blockers, just things to know:

- **`flux push artifact`** only speaks plain HTTP to `localhost`, not to a named
  host → push via `localhost:5000` (same registry container). `--insecure-registry`
  alone is not enough for a named host.
- **`helm push`** needs `--plain-http`.
- **`docker push`** to `localhost:5000` is plain-HTTP by default; to
  `kind-registry:5000` it works too because `kind-registry` resolves to
  `127.0.0.1` (in docker's default insecure `127.0.0.0/8` range).
- **Operator OCM fetch** works over HTTP because the VectorTemplate/StageConfiguration
  `vector:`/`components:` URLs carry the explicit `oci::http://` scheme.
- **Flux `OCIRepository`/`HelmChart` pull** over HTTP needs `spec.insecure: true`,
  set via the `konfidence.cloud/registry-insecure: "true"` label on the
  **ArtifactDeployment** — it does NOT propagate from the VectorTemplate, so it
  must be applied per-AD (and the AD spec is immutable, so you delete the
  generated `OCIRepository`/`HelmRepository` to retrigger).
- **kubelet image pulls**: containerd `hosts.toml` with `server = "http://..."`
  (scripted in `02-setup-registry.sh`).
- **`/etc/hosts` alias** `127.0.0.1 kind-registry` is required either way (so the
  host resolves the same name the cluster pulls from).

## Bottom line

The blocker is a single missing capability: **`ocm add` cannot compute resource
digests against a plain-HTTP registry**, and Konfidence will not accept a
digest-less component. Until the OCM CLI grows a plain-HTTP option for the digest
path (or Konfidence accepts on-the-fly digesting from an http source), the local
quickstart must use TLS.
