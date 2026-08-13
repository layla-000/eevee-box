(() => {
  function multiplierLabel(value){
    if (value === 0) return '효과 없음';
    if (value === 0.25) return '×0.25';
    if (value === 0.5) return '×0.5';
    return `×${value}`;
  }
  function multiplierClass(value){
    return value >= 4 ? 'quad' : value >= 2 ? 'super' : value === 1 ? 'neutral' : value === 0 ? 'immune' : 'resist';
  }
  function typePillLocal(type){
    return `<span class="type-pill" data-type="${escapeHtml(type)}">${escapeHtml(type)}</span>`;
  }
  function selectedTeamRecordsLocal(){
    return battle.myTeam.map(id => pokemon.find(record => record.id === id)).filter(Boolean);
  }
  function selectedOpponentEntries(){
    return battle.opponentTeam.map((opponent,index) => {
      const catalog = typeof findCatalogPokemon === 'function' ? findCatalogPokemon(opponent.catalogId, opponent.name) : null;
      const types = catalog?.types?.length ? catalog.types : String(opponent.types || '').split(',').map(v=>v.trim()).filter(Boolean);
      return opponent.name ? {opponent,index,types} : null;
    }).filter(Boolean);
  }
  function damagingOpponentMoves(){
    return selectedOpponentEntries().flatMap(({opponent,index}) =>
      (opponent.moves || []).map(moveName => {
        const move = moves.find(item => item.name === moveName);
        if (!move?.type || move.category === '변화') return null;
        return {opponent,index,moveName,moveType:move.type};
      }).filter(Boolean)
    );
  }

  window.renderTeamAnalysis = function renderTeamAnalysis(){
    const container = document.querySelector('#teamAnalysis');
    if (!container) return;
    const team = selectedTeamRecordsLocal();
    if (!team.length){
      container.innerHTML = '<p class="analysis-empty">내 팀을 선택하면 타입 상성과 실제 기술 커버리지를 분석해요.</p>';
      return;
    }
    const matchup = window.EeveeTypeMatchups;
    if (!matchup){
      container.innerHTML = '<p class="analysis-empty">타입 상성 모듈을 불러오지 못했어요.</p>';
      return;
    }

    const opponentMoves = damagingOpponentMoves();
    const defenseHtml = !selectedOpponentEntries().length
      ? '<p class="analysis-empty">상대 포켓몬을 선택하면 상대 기술 기준으로 내 팀의 방어 배율을 분석해요.</p>'
      : !opponentMoves.length
        ? '<p class="analysis-empty">상대 팀에 공격 기술이 등록되어 있지 않아요.</p>'
        : team.map(record => {
            const defenseTypes = Array.isArray(record.types) ? record.types.filter(Boolean) : [];
            const hits = opponentMoves.map(entry => ({
              ...entry,
              multiplier: matchup.attackMultiplier(entry.moveType, defenseTypes)
            })).sort((a,b) => b.multiplier-a.multiplier || a.moveName.localeCompare(b.moveName,'ko'));
            const worst = Math.max(...hits.map(item => item.multiplier));
            const groups = [4,2,1,0.5,0.25,0].map(multiplier => ({
              multiplier,
              hits:hits.filter(item => item.multiplier === multiplier)
            })).filter(group => group.hits.length);
            return `<article class="opponent-coverage-card defense-coverage-card">
              <div class="opponent-coverage-head">
                <div><span class="opponent-index">내 포켓몬</span><strong>${escapeHtml(record.nickname || record.species)}</strong><div class="opponent-type-list">${defenseTypes.map(typePillLocal).join('')}</div></div>
                <span class="best-multiplier ${multiplierClass(worst)}">최대 ${multiplierLabel(worst)}</span>
              </div>
              <div class="opponent-hit-groups">${groups.map(group => `
                <div class="opponent-hit-group ${multiplierClass(group.multiplier)}">
                  <span class="hit-multiplier">${multiplierLabel(group.multiplier)}</span>
                  <div>${group.hits.map(hit => `<span class="hit-chip">상대 ${hit.index+1} ${escapeHtml(hit.opponent.name)} · ${escapeHtml(hit.moveName)} <small>${escapeHtml(hit.moveType)}</small></span>`).join('')}</div>
                </div>`).join('')}</div>
            </article>`;
          }).join('');

    const teamMoves = team.flatMap(record => (record.currentMoves || []).map(moveName => {
      const move = moves.find(item => item.name === moveName);
      return move?.type && move.category !== '변화' ? {record,moveName,moveType:move.type} : null;
    }).filter(Boolean));
    const selectedOpponents = selectedOpponentEntries();
    const opponentCoverageHtml = !selectedOpponents.length
      ? '<p class="analysis-empty">상대 포켓몬을 선택하면 현재 기술 기준 공격 배율을 분석해요.</p>'
      : !teamMoves.length
        ? '<p class="analysis-empty">내 팀에 공격 기술이 등록되어 있지 않아요.</p>'
        : selectedOpponents.map(({opponent,index,types}) => {
            const defenseTypes = opponent.teraType ? [opponent.teraType] : types;
            const hits = teamMoves.map(entry => ({...entry,multiplier:matchup.attackMultiplier(entry.moveType, defenseTypes)}))
              .sort((a,b) => b.multiplier-a.multiplier || a.moveName.localeCompare(b.moveName,'ko'));
            const best = Math.max(...hits.map(item => item.multiplier));
            const groups = [4,2,1,0.5,0.25,0].map(multiplier => ({multiplier,hits:hits.filter(item => item.multiplier===multiplier)})).filter(group=>group.hits.length);
            return `<article class="opponent-coverage-card">
              <div class="opponent-coverage-head">
                <div><span class="opponent-index">상대 ${index+1}</span><strong>${escapeHtml(opponent.name)}</strong><div class="opponent-type-list">${defenseTypes.map(typePillLocal).join('')}</div></div>
                <span class="best-multiplier ${multiplierClass(best)}">최대 ${multiplierLabel(best)}</span>
              </div>
              <div class="opponent-hit-groups">${groups.map(group => `<div class="opponent-hit-group ${multiplierClass(group.multiplier)}"><span class="hit-multiplier">${multiplierLabel(group.multiplier)}</span><div>${group.hits.map(hit => `<span class="hit-chip">${escapeHtml(hit.record.nickname || hit.record.species)} · ${escapeHtml(hit.moveName)} <small>${escapeHtml(hit.moveType)}</small></span>`).join('')}</div></div>`).join('')}</div>
            </article>`;
          }).join('');

    const leadHtml = battle.battleFormat === 'double' ? `<div class="lead-analysis"><strong>선봉</strong><span>${battle.leadIndices.length ? battle.leadIndices.map(index => {const record=pokemon.find(item=>item.id===battle.myTeam[index]); return record ? escapeHtml(record.nickname || record.species) : '';}).filter(Boolean).join(' + ') : '아직 지정하지 않았어요'}</span><small>${battle.leadIndices.length}/2</small></div>` : '';

    container.innerHTML = `${leadHtml}<div class="team-analysis-grid">
      <section class="team-analysis-card"><div class="team-analysis-head"><span>DEFENSE</span><h3>팀 방어 약점</h3></div>${defenseHtml}<p class="analysis-caption">상대 팀에 등록된 실제 공격 기술을 내 포켓몬의 타입에 적용해 계산해요. 변화 기술은 제외합니다.</p></section>
      <section class="team-analysis-card"><div class="team-analysis-head"><span>OFFENSE</span><h3>상대 팀 공격 커버리지</h3></div>${opponentCoverageHtml}<p class="analysis-caption">내 팀에 등록된 실제 공격 기술을 상대의 타입에 적용해 계산해요. 상대 테라 타입이 선택되어 있으면 그 타입을 방어 타입으로 사용합니다.</p></section>
    </div>`;

    window.EeveeBoxTypeColors?.repaint?.();
    window.EeveeBoxMoveCategoryColors?.repaint?.();
  };

  // battle.js의 첫 render()가 끝난 뒤 새 분석기로 한 번 다시 그립니다.
  const rerender = () => {
    try { if (typeof battle !== 'undefined' && document.querySelector('#teamAnalysis')) window.renderTeamAnalysis(); } catch (_) {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(rerender, 0), {once:true});
  else setTimeout(rerender, 0);
})();
