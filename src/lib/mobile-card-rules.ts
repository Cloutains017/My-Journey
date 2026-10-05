export function observeMobileCardRules(root: HTMLElement): () => void {
  const cards = [...root.querySelectorAll<HTMLElement>(".journey-result")];
  const mobile = window.matchMedia("(max-width: 767px)");
  let observer: IntersectionObserver | null = null;
  let active: HTMLElement | undefined;
  let disposed = false;

  function select(card?: HTMLElement) {
    if (card === active) return;
    if (active) delete active.dataset.scrollActive;
    active = card;
    if (active) active.dataset.scrollActive = "true";
  }

  function sync() {
    if (disposed || !mobile.matches) return;
    const midpoint = window.innerHeight / 2;
    // A two-pixel band avoids rounding gaps at shared card boundaries.
    select(cards.find(card => {
      const bounds = card.getBoundingClientRect();
      return bounds.top <= midpoint + 1 && bounds.bottom > midpoint - 1;
    }));
  }

  function observe() {
    observer?.disconnect();
    observer = null;
    if (!mobile.matches) { select(); return; }
    const midpoint = window.innerHeight / 2;
    observer = new IntersectionObserver(sync, {
      rootMargin: `${1 - midpoint}px 0px ${1 - midpoint}px 0px`, threshold: 0,
    });
    cards.forEach(card => observer!.observe(card));
    sync();
  }

  mobile.addEventListener("change", observe);
  window.addEventListener("resize", observe);
  observe();
  return () => {
    disposed = true;
    observer?.disconnect();
    mobile.removeEventListener("change", observe);
    window.removeEventListener("resize", observe);
    select();
  };
}
