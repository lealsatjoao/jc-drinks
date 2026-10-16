// JC Drinks: página de pedido de orçamento. Tudo o que muda (drinks, balcões, datas fechadas, WhatsApp) fica aqui em cima.

const WHATSAPP = "5512992282276";

// Datas que a JC Drinks já confirmou como fechadas (AAAA-MM-DD). Pedido de orçamento NÃO fecha data.
const DATAS_FECHADAS = ["2026-11-07", "2026-11-14", "2026-11-21", "2026-11-28"];

const TIPOS = ["Casamento", "Aniversário", "15 anos", "Empresa", "Outra festa"];

const DRINKS = [
  {
    id: "caipirinha",
    nome: "Caipirinha",
    cor: "#8fae3c",
    ingredientes: "Fruta, açúcar, bebida e gelo.",
    escolhas: [
      { titulo: "Com", opcoes: ["Cachaça", "Vodka", "Saquê"] },
      { titulo: "Frutas", opcoes: ["Limão", "Morango", "Maracujá", "Abacaxi"] },
    ],
  },
  { id: "pina", nome: "Piña Colada", cor: "#e9d8a6", ingredientes: "Rum, suco de abacaxi, leite de coco, leite condensado e gelo." },
  { id: "sex", nome: "Sex on the Beach", cor: "linear-gradient(#f2a03d, #c8322f)", ingredientes: "Vodka, suco de pêssego, suco de laranja, groselha e gelo." },
  { id: "grego", nome: "Grego Freza", cor: "#c86f8d", ingredientes: "Leite, leite condensado, polpa de fruta e gelo." },
  { id: "kids", nome: "Kids on the Beach", sub: "Sem álcool", cor: "linear-gradient(#f6c36a, #e0566a)", ingredientes: "Suco de pêssego, suco de laranja, groselha e gelo." },
];

const BALCOES = [
  { id: "led", nome: "Balcão iluminado", desc: "Frente com luz de LED. Destaque à noite." },
  { id: "espelhado", nome: "Balcão espelhado", desc: "Acabamento claro e espelhado. Combina com decoração clássica." },
  { id: "ajuda", nome: "Quero ajuda para escolher", desc: "A gente sugere de acordo com a festa." },
];

// ---------- estado ----------
const pedido = { tipo: "", data: "", balcao: "", drinks: {} }; // drinks: { id: { escolhas: { titulo: [opções] } } }

const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...filhos) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
  }
  for (const f of filhos.flat()) if (f != null) e.append(f);
  return e;
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dataLonga = (s) => {
  const [a, m, d] = s.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};
const dataCurta = (s) => s.split("-").reverse().join("/");

// ---------- tipo de festa ----------
function montarTipos() {
  const c = $("#tipos");
  c.replaceChildren(
    ...TIPOS.map((t) =>
      el("button", { type: "button", class: "opcao", role: "radio", "aria-checked": String(pedido.tipo === t), onclick: () => { pedido.tipo = t; montarTipos(); atualizar(); } }, t),
    ),
  );
}

// ---------- calendário ----------
const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
let mesVisto = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

function montarCalendario() {
  const c = $("#calendario");
  const ano = mesVisto.getFullYear(), mes = mesVisto.getMonth();
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const dias = new Date(ano, mes + 1, 0).getDate();
  const ehMesAtual = ano === hoje.getFullYear() && mes === hoje.getMonth();

  const cab = el("div", { class: "cal-cab" },
    el("span", { class: "cal-mes" }, (() => { const m = mesVisto.toLocaleDateString("pt-BR", { month: "long" }); return `${m[0].toUpperCase()}${m.slice(1)} ${ano}`; })()),
    el("div", { class: "cal-nav" },
      el("button", { type: "button", "aria-label": "Mês anterior", disabled: ehMesAtual, onclick: () => { mesVisto = new Date(ano, mes - 1, 1); montarCalendario(); } }, "‹"),
      el("button", { type: "button", "aria-label": "Próximo mês", onclick: () => { mesVisto = new Date(ano, mes + 1, 1); montarCalendario(); } }, "›"),
    ),
  );

  const grade = el("div", { class: "cal-grade" }, ...["D", "S", "T", "Q", "Q", "S", "S"].map((s) => el("span", { class: "cal-sem", "aria-hidden": "true" }, s)));
  for (let i = 0; i < primeiroDia; i++) grade.append(el("span"));
  for (let d = 1; d <= dias; d++) {
    const data = new Date(ano, mes, d);
    const chave = iso(data);
    const passado = data < hoje;
    const fechado = DATAS_FECHADAS.includes(chave);
    const classes = ["dia", passado && "passado", fechado && "fechado", chave === iso(hoje) && "hoje", pedido.data === chave && "escolhido"].filter(Boolean).join(" ");
    grade.append(
      el("button", {
        type: "button", class: classes, disabled: passado || fechado,
        "aria-label": `${dataLonga(chave)}${fechado ? ", fechado" : ""}`, "aria-pressed": String(pedido.data === chave),
        onclick: () => { pedido.data = chave; montarCalendario(); atualizar(); },
      }, String(d)),
    );
  }
  c.replaceChildren(cab, grade, el("p", { class: "data-texto", "aria-live": "polite" }, pedido.data ? dataLonga(pedido.data) : ""));
}

// ---------- carta de drinks ----------
function montarDrinks() {
  $("#lista-drinks").replaceChildren(
    ...DRINKS.map((d) => {
      const escolhido = !!pedido.drinks[d.id];
      const escolhas = d.escolhas
        ? el("div", { class: "drink-escolhas", hidden: !escolhido },
            ...d.escolhas.map((g) =>
              el("div", {},
                el("div", { class: "escolha-titulo" }, g.titulo),
                el("div", { class: "marcas" },
                  ...g.opcoes.map((o) => {
                    const marcado = !!pedido.drinks[d.id]?.escolhas?.[g.titulo]?.includes(o);
                    return el("button", {
                      type: "button", class: "marca-op", "aria-pressed": String(marcado),
                      onclick: () => {
                        const lista = (pedido.drinks[d.id].escolhas[g.titulo] ??= []);
                        const i = lista.indexOf(o);
                        if (i >= 0) lista.splice(i, 1); else lista.push(o);
                        montarDrinks(); atualizar();
                      },
                    }, o);
                  }),
                ),
              ),
            ),
          )
        : null;
      return el("li", { class: "drink", style: `--cor:${d.cor}` },
        el("div", { class: "drink-linha" },
          el("span", { class: "drink-cor", "aria-hidden": "true" }),
          el("div", {},
            el("h3", { class: "drink-nome" }, d.nome, d.sub ? el("small", {}, d.sub) : null),
            el("p", { class: "drink-ing" }, d.ingredientes),
          ),
          el("button", {
            type: "button", class: "add", "aria-pressed": String(escolhido),
            onclick: () => {
              if (escolhido) delete pedido.drinks[d.id];
              else pedido.drinks[d.id] = { escolhas: {} };
              montarDrinks(); atualizar();
            },
          }, escolhido ? "Na carta ✓" : "Adicionar"),
        ),
        escolhas,
      );
    }),
  );
}

// ---------- balcão ----------
function montarBalcoes() {
  $("#lista-balcoes").replaceChildren(
    ...BALCOES.map((b) =>
      el("li", {},
        el("button", { type: "button", class: "balcao-op", role: "radio", "aria-checked": String(pedido.balcao === b.id), onclick: () => { pedido.balcao = b.id; montarBalcoes(); atualizar(); } },
          el("span", { class: "radio", "aria-hidden": "true" }),
          el("span", {}, el("span", { class: "balcao-nome" }, b.nome), el("span", { class: "balcao-desc" }, b.desc)),
        ),
      ),
    ),
  );
}

// ---------- pedido ----------
const valor = (s) => $(s).value.trim();
function drinksTexto() {
  return Object.entries(pedido.drinks).map(([id, { escolhas }]) => {
    const d = DRINKS.find((x) => x.id === id);
    const extra = Object.values(escolhas).filter((l) => l.length).map((l) => l.join(", ")).join(" · ");
    return extra ? `${d.nome} (${extra})` : d.nome;
  });
}

function atualizar() {
  const n = Object.keys(pedido.drinks).length;
  $("#barra-titulo").textContent = n ? `${n} ${n === 1 ? "drink" : "drinks"} na carta` : "Seu pedido";
  const partes = [pedido.tipo, pedido.data && dataCurta(pedido.data), valor("#convidados") && `${valor("#convidados")} convidados`].filter(Boolean);
  $("#barra-sub").textContent = partes.length ? partes.join(" · ") : "Escolha a data e os drinks";
}

function faltando() {
  const f = [];
  if (!pedido.tipo) f.push("o tipo de festa");
  if (!pedido.data) f.push("a data");
  if (!valor("#convidados")) f.push("quantos convidados");
  if (!Object.keys(pedido.drinks).length) f.push("pelo menos um drink");
  if (!valor("#nome")) f.push("seu nome");
  return f;
}

function abrirPedido() {
  const bal = BALCOES.find((b) => b.id === pedido.balcao);
  const linhas = [
    ["Festa", pedido.tipo],
    ["Data", pedido.data && `${dataLonga(pedido.data)}, às ${valor("#horario") || "—"}`],
    ["Convidados", valor("#convidados")],
    ["Local", valor("#cidade")],
    ["Drinks", drinksTexto().join("\n")],
    ["Balcão", bal?.nome],
    ["Nome", valor("#nome")],
    ["WhatsApp", valor("#telefone")],
    ["Obs.", valor("#obs")],
  ];
  $("#revisao").replaceChildren(
    ...linhas.map(([k, v]) =>
      el("div", {}, el("dt", {}, k), el("dd", { class: v ? "" : "vazio", style: "white-space:pre-line" }, v || "—")),
    ),
  );
  const f = faltando();
  $("#falta").hidden = !f.length;
  $("#falta").textContent = f.length ? `Falta: ${f.join(", ")}.` : "";
  $("#enviar").disabled = !!f.length;
  $("#enviar").style.opacity = f.length ? ".45" : "1";
  $("#folha").hidden = false;
}

function mensagem() {
  const bal = BALCOES.find((b) => b.id === pedido.balcao);
  return [
    "Olá, JC Drinks! Quero um orçamento:",
    "",
    `*Festa:* ${pedido.tipo}`,
    `*Data:* ${dataLonga(pedido.data)}, às ${valor("#horario") || "—"}`,
    `*Convidados:* ${valor("#convidados")}`,
    valor("#cidade") && `*Local:* ${valor("#cidade")}`,
    "",
    "*Drinks:*",
    ...drinksTexto().map((t) => `• ${t}`),
    "",
    bal && `*Balcão:* ${bal.nome}`,
    `*Nome:* ${valor("#nome")}`,
    valor("#telefone") && `*WhatsApp:* ${valor("#telefone")}`,
    valor("#obs") && `*Obs.:* ${valor("#obs")}`,
  ].filter((l) => typeof l === "string").join("\n").replace(/\n{3,}/g, "\n\n");
}

document.addEventListener("click", (e) => { if (e.target.closest("[data-fechar]")) $("#folha").hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#folha").hidden = true; });
$("#abrir-pedido").addEventListener("click", abrirPedido);
$("#enviar").addEventListener("click", () => {
  if (faltando().length) return;
  window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensagem())}`, "_blank", "noopener");
});
["#convidados", "#nome"].forEach((s) => $(s).addEventListener("input", atualizar));

montarTipos();
montarCalendario();
montarDrinks();
montarBalcoes();
atualizar();
