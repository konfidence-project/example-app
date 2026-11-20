<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import Icon, { type IconName } from "#lib/components/Icon.svelte";

  let { data, children } = $props();

  const groups: { label: string; items: { href: string; label: string; icon: IconName }[] }[] = [
    {
      label: "Workspace",
      items: [
        { href: "/", label: "Schedule", icon: "calendar" },
        { href: "/people", label: "People", icon: "users" },
      ],
    },
    { label: "Debug", items: [{ href: "/routing", label: "Routing", icon: "route" }] },
  ];

  const active = (href: string) => (href === "/" ? page.url.pathname === "/" : page.url.pathname.startsWith(href));
</script>

<div class="shell">
  <aside>
    <a class="brand" href="/" aria-label="Home">
      <img class="logo light" src="/logos/logo-light.svg" alt="Konfidence" />
      <img class="logo dark" src="/logos/logo-dark.svg" alt="" aria-hidden="true" />
    </a>
    <nav>
      {#each groups as g (g.label)}
        <div class="group">
          <span class="group-label">{g.label}</span>
          {#each g.items as item (item.href)}
            <a href={item.href} class="nav" class:active={active(item.href)} aria-current={active(item.href) ? "page" : undefined}>
              <Icon name={item.icon} />{item.label}
            </a>
          {/each}
        </div>
      {/each}
    </nav>
    <div class="env">
      <div class="env-row">
        <span>Stage</span>
        <span class="badge amber">{data.stage || "unknown"}</span>
      </div>
      <span class="mono key" title="X-Konfidence-Routing-Key">{data.routingKey || "no routing key"}</span>
    </div>
  </aside>
  <div class="main">
    {@render children()}
  </div>
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    min-height: 100vh;
  }
  aside {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    height: 100vh;
    padding: var(--space-5) var(--space-4);
    border-right: 1px solid var(--border-subtle);
    background: var(--surface-subtle);
  }
  .brand {
    padding: 6px var(--space-3);
  }
  .logo {
    display: block;
    height: 14px;
    width: auto;
  }
  .logo.dark,
  :global(.dark) .logo.light {
    display: none;
  }
  :global(.dark) .logo.dark {
    display: block;
  }
  nav {
    display: grid;
    gap: var(--space-6);
  }
  .group {
    display: grid;
    gap: 2px;
  }
  .group-label {
    padding: 0 var(--space-3) 6px;
    color: var(--text-tertiary);
    font-size: 11px;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-weight: var(--weight-medium);
    text-decoration: none;
  }
  .nav:hover {
    background: var(--surface-sunken);
    color: var(--text-primary);
  }
  .nav.active {
    border-color: var(--tag-amber-bd);
    background: var(--selection-bg);
    color: var(--text-primary);
    font-weight: var(--weight-semibold);
  }
  .env {
    display: grid;
    gap: 6px;
    margin-top: auto;
    padding: var(--space-3);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    background: var(--surface-default);
  }
  .env-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--text-secondary);
    font-size: var(--font-size-meta);
    font-weight: var(--weight-medium);
  }
  .key {
    overflow: hidden;
    color: var(--text-tertiary);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .main {
    min-width: 0;
  }

  @media (max-width: 760px) {
    .shell {
      grid-template-columns: 1fr;
    }
    aside {
      position: static;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      height: auto;
      padding: var(--space-3) var(--space-4);
      border-right: 0;
      border-bottom: 1px solid var(--border-subtle);
    }
    nav {
      display: flex;
      gap: var(--space-1);
    }
    .group {
      display: flex;
    }
    .group-label,
    .env {
      display: none;
    }
  }
</style>
