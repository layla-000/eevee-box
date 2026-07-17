(() => {
  const CATEGORY_COLORS = Object.freeze({
    변화:"#5F6B7A",
    특수:"#3B82F6",
    물리:"#DC6B3F"
  });

  let moveCategoryByName = new Map();
  let scheduled = false;

  function normalize(value){
    return String(value || "").replace(/\s+/gu, " ").trim();
  }

  function exactCategory(value){
    const text = normalize(value);
    return Object.keys(CATEGORY_COLORS).find(category => text === category) || "";
  }

  function categoryInText(value){
    const text = normalize(value);
    return Object.keys(CATEGORY_COLORS).find(category =>
      text === category ||
      text.startsWith(`${category} `) ||
      text.endsWith(` ${category}`) ||
      text.includes(`· ${category}`) ||
      text.includes(`${category} ·`)
    ) || "";
  }

  function applyCategoryColor(element, category){
    if (!element || !CATEGORY_COLORS[category]) return;
    element.classList.add("move-category-colored");
    element.dataset.category = category;
    element.style.setProperty("--move-category-color", CATEGORY_COLORS[category]);
  }

  function colorCategoryLabels(root = document){
    root.querySelectorAll(
      ".move-meta span, .move-reference-head span, [data-move-category]"
    ).forEach(element => {
      const category =
        exactCategory(element.dataset.moveCategory) ||
        exactCategory(element.textContent) ||
        categoryInText(element.textContent);

      if (category) applyCategoryColor(element, category);
    });
  }

  function findMoveName(element){
    const candidates = [
      element.dataset.move,
      element.querySelector("strong")?.textContent,
      element.querySelector(".move-name")?.textContent,
      element.textContent
    ];

    for (const candidate of candidates){
      const text = normalize(candidate);
      if (moveCategoryByName.has(text)) return text;

      for (const name of moveCategoryByName.keys()){
        if (
          text === name ||
          text.startsWith(`${name} `) ||
          text.startsWith(`${name}\n`)
        ){
          return name;
        }
      }
    }
    return "";
  }

  function colorMoveCards(root = document){
    root.querySelectorAll(
      ".move-slot, .move-row, .my-move-effect-card, .opponent-move-row, .move-reference-detail"
    ).forEach(element => {
      const moveName = findMoveName(element);
      const category = moveCategoryByName.get(moveName);
      if (!category) return;

      element.classList.add("move-category-card");
      element.style.setProperty("--move-category-color", CATEGORY_COLORS[category]);
    });
  }

  function colorMoveSelect(select){
    const category = moveCategoryByName.get(select.value);
    select.classList.add("move-category-aware");
    select.style.setProperty(
      "--selected-category-color",
      category ? CATEGORY_COLORS[category] : "var(--line)"
    );
  }

  function bindMoveSelects(root = document){
    root.querySelectorAll(
      ".opp-move-select, #moveSelects select, select[data-move-select]"
    ).forEach(select => {
      if (!select.dataset.moveCategoryBound){
        select.dataset.moveCategoryBound = "true";
        select.addEventListener("change", () => {
          colorMoveSelect(select);
          schedulePaint();
        });
      }
      colorMoveSelect(select);
    });
  }

  function paint(){
    scheduled = false;
    colorCategoryLabels();
    colorMoveCards();
    bindMoveSelects();
  }

  function schedulePaint(){
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(paint);
  }

  async function loadMoves(){
    try {
      const response = await fetch("moves.json", {cache:"no-store"});
      if (!response.ok) throw new Error(`moves.json ${response.status}`);

      const moves = await response.json();
      moveCategoryByName = new Map(
        moves
          .filter(move => move?.name && CATEGORY_COLORS[move?.category])
          .map(move => [normalize(move.name), move.category])
      );
    } catch (error){
      console.warn("기술 분류 색상 데이터를 불러오지 못했어요.", error);
    }

    schedulePaint();
  }

  const observer = new MutationObserver(schedulePaint);

  function initialize(){
    observer.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true
    });

    schedulePaint();
    loadMoves();
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initialize, {once:true});
  } else {
    initialize();
  }

  window.EeveeBoxMoveCategoryColors = {
    colors:CATEGORY_COLORS,
    repaint:schedulePaint
  };
})();
