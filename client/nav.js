// Tabs between the two phone pages. Keeps ?demo in the links so the demo stays a demo.

const TABS = [
  { href: "player.html", label: "Rathaus-Rätsel" },
  { href: "canvas.html", label: "Pixel-Leinwand" },
];

export function renderTabs(container, current) {
  const search = location.search;
  container.classList.add("tabs");
  container.setAttribute("aria-label", "Spiele");
  container.replaceChildren(
    ...TABS.map(({ href, label }) => {
      const a = document.createElement("a");
      a.href = href + search;
      a.textContent = label;
      if (href === current) a.setAttribute("aria-current", "page");
      return a;
    }),
  );
}
