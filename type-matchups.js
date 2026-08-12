(() => {
  const TYPES = ['노말','불꽃','물','전기','풀','얼음','격투','독','땅','비행','에스퍼','벌레','바위','고스트','드래곤','악','강철','페어리'];
  const superEffective = {
    노말:[], 불꽃:['풀','얼음','벌레','강철'], 물:['불꽃','땅','바위'], 전기:['물','비행'], 풀:['물','땅','바위'], 얼음:['풀','땅','비행','드래곤'],
    격투:['노말','얼음','바위','악','강철'], 독:['풀','페어리'], 땅:['불꽃','전기','독','바위','강철'], 비행:['풀','격투','벌레'], 에스퍼:['격투','독'],
    벌레:['풀','에스퍼','악'], 바위:['불꽃','얼음','비행','벌레'], 고스트:['에스퍼','고스트'], 드래곤:['드래곤'], 악:['에스퍼','고스트'], 강철:['얼음','바위','페어리'], 페어리:['격투','드래곤','악']
  };
  const resisted = {
    노말:['바위','강철'], 불꽃:['불꽃','물','바위','드래곤'], 물:['물','풀','드래곤'], 전기:['전기','풀','드래곤'], 풀:['불꽃','풀','독','비행','벌레','드래곤','강철'],
    얼음:['불꽃','물','얼음','강철'], 격투:['독','비행','에스퍼','벌레','페어리'], 독:['독','땅','바위','고스트'], 땅:['풀','벌레'], 비행:['전기','바위','강철'],
    에스퍼:['에스퍼','강철'], 벌레:['불꽃','격투','독','비행','고스트','강철','페어리'], 바위:['격투','땅','강철'], 고스트:['악'], 드래곤:['강철'], 악:['격투','악','페어리'], 강철:['불꽃','물','전기','강철'], 페어리:['불꽃','독','강철']
  };
  const immune = {노말:['고스트'], 전기:['땅'], 격투:['고스트'], 독:['강철'], 땅:['비행'], 에스퍼:['악'], 고스트:['노말'], 드래곤:['페어리']};

  function normalizeTypes(types){
    return [...new Set((types || []).map(x => String(x || '').trim()).filter(x => TYPES.includes(x)))];
  }

  function attackMultiplier(attackType, defenseTypes){
    return normalizeTypes(defenseTypes).reduce((m, defenseType) => {
      if (m === 0) return 0;
      if ((immune[attackType] || []).includes(defenseType)) return 0;
      if ((superEffective[attackType] || []).includes(defenseType)) return m * 2;
      if ((resisted[attackType] || []).includes(defenseType)) return m * .5;
      return m;
    }, 1);
  }

  function defense(types){
    const groups = {4:[], 2:[], 1:[], 0.5:[], 0.25:[], 0:[]};
    TYPES.forEach(attackType => {
      const multiplier = attackMultiplier(attackType, types);
      (groups[multiplier] ||= []).push(attackType);
    });
    return groups;
  }

  function esc(value){
    return String(value ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;');
  }

  function pills(list){
    return (list || []).map(type => `<span class="matchup-type type-pill" data-type="${esc(type)}">${esc(type)}</span>`).join('');
  }

  function row(label, list, tone){
    if (!list?.length) return '';
    return `<div class="matchup-row matchup-${tone}"><span class="matchup-label">${label}</span><div class="matchup-pills">${pills(list)}</div></div>`;
  }

  function panel(types, title){
    const cleanTypes = normalizeTypes(types);
    if (!cleanTypes.length) return '';
    const g = defense(cleanTypes);
    const typeText = cleanTypes.join(' / ');
    return `<div class="matchup-panel">
      <div class="matchup-panel-head"><strong>${esc(title)}</strong><span>${esc(typeText)}</span></div>
      ${row('×4 약점', g[4], 'danger-strong')}
      ${row('×2 약점', g[2], 'danger')}
      ${row('×0 무효', g[0], 'immune')}
      ${row('×¼ 반감', g[0.25], 'resist-strong')}
      ${row('×½ 반감', g[0.5], 'resist')}
      ${g[1]?.length ? `<details class="matchup-neutral"><summary>×1 보통 <span>${g[1].length}개 타입</span></summary><div class="matchup-pills">${pills(g[1])}</div></details>` : ''}
    </div>`;
  }

  function summary(types, teraType=''){
    const cleanTypes = normalizeTypes(types);
    if (!cleanTypes.length) return '';
    const cleanTera = TYPES.includes(String(teraType || '').trim()) ? String(teraType).trim() : '';
    const teraPanel = cleanTera ? panel([cleanTera], '테라스탈 시') : '';
    return `<section class="matchup-summary">
      <div class="matchup-title-row"><div><span class="matchup-kicker">DEFENSE</span><strong>방어 타입 상성</strong></div><small>공격받을 때 기준</small></div>
      ${panel(cleanTypes, '기본 타입')}
      ${teraPanel}
    </section>`;
  }

  window.EeveeTypeMatchups = { TYPES, attackMultiplier, defense, summary };
})();
