<script lang="ts">
  import { initials } from "#lib/time.ts";

  let { name, size = "sm" }: { name: string; size?: "sm" | "lg" } = $props();
</script>

<span class="avatar {size}" aria-hidden="true">{initials(name)}</span>

<style>
  .avatar {
    display: inline-grid;
    flex: none;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--gradient-planet);
    color: var(--text-on-accent);
    font-size: 12px;
    font-weight: var(--weight-semibold);
  }
  .lg {
    width: 56px;
    height: 56px;
    font-size: 20px;
  }
</style>
