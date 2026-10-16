// Animações leves da página de entrada: as partes surgem quando chegam na tela. Sem script, tudo aparece normal.
(() => {
  const parado = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const alvos = document.querySelectorAll(".revela, .revela-foto");
  if (parado || !("IntersectionObserver" in window)) { alvos.forEach((e) => e.classList.add("visto")); return; }
  const olho = new IntersectionObserver((itens) => {
    for (const i of itens) if (i.isIntersecting) { i.target.classList.add("visto"); olho.unobserve(i.target); }
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
  alvos.forEach((e) => olho.observe(e));
})();
