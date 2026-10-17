// Animações leves da página de entrada (inspiradas nos efeitos de texto do Magic UI, feitas sem biblioteca):
//  - as partes surgem quando chegam na tela;
//  - frases com .palavras aparecem palavra por palavra, saindo do desfoque;
//  - .troca troca a última palavra de tempos em tempos (casamentos, aniversários…);
//  - .brilho: um brilho passa devagar pelo texto do botão.
// Sem script ou com "reduzir movimento", tudo aparece normal e parado.
(() => {
  const parado = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // palavra por palavra: cada palavra vira um <span> com atraso crescente (mantém negrito/itálico)
  if (!parado) document.querySelectorAll(".palavras").forEach((el) => {
    let n = 0;
    const partir = (no) => {
      for (const filho of [...no.childNodes]) {
        if (filho.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const pedaco of filho.textContent.split(/(\s+)/)) {
            if (!pedaco) continue;
            if (/^\s+$/.test(pedaco)) { frag.append(pedaco); continue; }
            const w = document.createElement("span");
            w.className = "palavra"; w.style.setProperty("--i", n++); w.textContent = pedaco;
            frag.append(w);
          }
          filho.replaceWith(frag);
        } else if (filho.nodeType === 1) partir(filho);
      }
    };
    partir(el);
  });
  const alvos = document.querySelectorAll(".revela, .revela-foto");
  if (parado || !("IntersectionObserver" in window)) { alvos.forEach((e) => e.classList.add("visto")); return; }
  const olho = new IntersectionObserver((itens) => {
    for (const i of itens) if (i.isIntersecting) { i.target.classList.add("visto"); olho.unobserve(i.target); }
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
  alvos.forEach((e) => olho.observe(e));

  // troca de palavra: sai para cima desfocando, a próxima entra de baixo
  document.querySelectorAll(".troca").forEach((el) => {
    const lista = el.dataset.palavras.split("|");
    let i = 0;
    setInterval(() => {
      if (document.hidden || !document.documentElement.classList.contains("abertura-pronta")) return;
      el.classList.add("sai");
      setTimeout(() => {
        i = (i + 1) % lista.length;
        el.textContent = lista[i];
        el.classList.remove("sai");
        el.classList.add("entra");
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("entra")));
      }, 380);
    }, 2600);
  });
})();
