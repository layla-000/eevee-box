(() => {
  const TYPE_COLORS = Object.freeze({
    노말:"#9FA19F",
    비행:"#81B9EF",
    땅:"#915121",
    바위:"#AFA981",
    고스트:"#704170",
    불꽃:"#E62829",
    물:"#2980EF",
    풀:"#3FA129",
    전기:"#FAC000",
    에스퍼:"#EF4179",
    얼음:"#3DCEF3",
    페어리:"#EF70EF",
    독:"#9141CB",
    강철:"#60A1B8",
    드래곤:"#5060E1",
    격투:"#FF8000",
    벌레:"#91A119",
    악:"#624D4E"
  });

  const TYPE_NAMES = Object.keys(TYPE_COLORS);
  let moveTypeByName = new Map();
  let scheduled = false;

  function normalize(value){
    return String(value || "")
      .replace(/^테라\s*/u, "")
      .replace(/\s+/gu, " ")
      .trim();
  }

  function exactTypeFromText(value){
    const text = normalize(value);
    return TYPE_NAMES.find(type => text === type) || "";
  }

  function typeInText(value){
    const text = normalize(value);
    return TYPE_NAMES.find(type =>
      text === type ||
      text.startsWith(`${type} `) ||
      text.endsWith(` ${type}`) ||
      text.includes(`· ${type}`) ||
      text.includes(`${type} ·`)
    ) || "";
  }

  function setTypeColor(element, type, className = "type-colored"){
    if (!element || !TYPE_COLORS[type]) return;
    element.classList.add(className);
    element.dataset.type = type;
    element.style.setProperty("--type-color", TYPE_COLORS[type]);
  }

  function colorTypeLabels(root = document){
    const selectors = [
      ".badge",
      ".type-pill",
      ".tera-pill",
      ".move-meta span",
      ".move-reference-head span"
    ];

    root.querySelectorAll(selectors.join(",")).forEach(element => {
      const type = exactTypeFromText(element.textContent) || typeInText(element.textContent);
      if (type) setTypeColor(element, type);
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
      const text = String(candidate || "").trim();
      if (moveTypeByName.has(text)) return text;

      for (const name of moveTypeByName.keys()){
        if (text === name || text.startsWith(`${name}\n`) || text.startsWith(`${name} `)){
          return name;
        }
      }
    }
    return "";
  }

  function colorMoveCards(root = document){
    const cardSelectors = [
      ".move-slot",
      ".move-row",
      ".my-move-effect-card",
      ".opponent-move-row",
      ".move-reference-detail"
    ];

    root.querySelectorAll(cardSelectors.join(",")).forEach(element => {
      const moveName = findMoveName(element);
      const type = moveTypeByName.get(moveName);
      if (!type) return;
      setTypeColor(element, type, "move-type-card");
    });

    root.querySelectorAll(".moves li, .preview-moves span").forEach(element => {
      const moveName = String(element.textContent || "").trim();
      const type = moveTypeByName.get(moveName);
      if (!type) return;
      setTypeColor(element, type, "move-type-name");
    });
  }

  function colorMoveSelect(select){
    const moveName = select.value;
    const type = moveTypeByName.get(moveName);
    select.classList.add("type-aware-select");
    select.style.setProperty(
      "--selected-type-color",
      type ? TYPE_COLORS[type] : "var(--line)"
    );
  }

  function bindMoveSelects(root = document){
    root.querySelectorAll(
      ".opp-move-select, #moveSelects select, select[data-move-select]"
    ).forEach(select => {
      if (!select.dataset.typeColorBound){
        select.dataset.typeColorBound = "true";
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
    colorTypeLabels();
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
      moveTypeByName = new Map(
        moves
          .filter(move => move?.name && TYPE_COLORS[move?.type])
          .map(move => [String(move.name).trim(), move.type])
      );
    } catch (error){
      console.warn("기술 타입 색상 데이터를 불러오지 못했어요.", error);
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

  window.EeveeBoxTypeColors = {
    colors: TYPE_COLORS,
    repaint: schedulePaint
  };
})();
