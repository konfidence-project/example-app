// Every route of the app in one place.
export const paths = {
  home: { href: "/" },
  schedule: {
    href: "/schedule",
    getHref: (params: { week?: string; type?: string } = {}) => {
      const query = new URLSearchParams();
      if (params.week) query.set("week", params.week);
      if (params.type && params.type !== "all") query.set("type", params.type);
      const qs = query.toString();
      return qs ? `/schedule?${qs}` : "/schedule";
    },
  },
  people: {
    href: "/people",
    getHref: (q?: string) => (q ? `/people?q=${encodeURIComponent(q)}` : "/people"),
  },
  candidate: {
    getHref: (id: string) => `/people/${encodeURIComponent(id)}`,
  },
} as const;
