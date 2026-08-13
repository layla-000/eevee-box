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
  function groupedHits(hits){
    return [4,2,1,0.5,0.25,0]
      .map(multiplier => ({ multiplier, hits: hits.filter(item => item.multiplier === multiplier) }))
      .filter(group => group.hits.length);
  }
  function renderHitGroups(groups, chipRenderer){
    return `<div class="opponent-hit-groups">${groups.map(group => `
      <div class="opponent-hit-group ${multiplierClass(group.multiplier)}">
        <span class="hit-multiplier">${multiplierLabel(group.multiplier)}</span>
        <div>${group.hits.map(chipRenderer).join('')}</div>
      </div>`).join('')}</div>`;
  }
  function analyzeHits(entries, defenseTypes, matchup){
    const hits = entries.map(entry => ({
      ...entry,
      multiplier: matchup.attackMultiplier(entry.moveType, defenseTypes)
    })).sort((a,b) => b.multiplier-a.multiplier || a.moveName.localeCompare(b.moveName,'ko'));
    return {
      hits,
      best: hits.length ? Math.max(...hits.map(item => item.multiplier)) : 0,
      groups: groupedHits(hits)
    };
  }
  function stateBlock(label, defenseTypes, analysis, chipRenderer, isTera){
    return `<div class="matchup-state ${isTera ? 'tera-state' : 'base-state'}">
      <div class="matchup-state-head">
        <div>
          <span class="matchup-state-label">${label}</span>
          <div class="opponent-type-list">${defenseTypes.map(typePillLocal).join('')}</div>
        </div>
        <span class="best-multiplier ${multiplierClass(analysis.best)}">최대 ${multiplierLabel(analysis.best)}</span>
      </div>
      ${renderHitGroups(analysis.groups, chipRenderer)}
    </div>`;
  }
  function ensureComparisonStyles(){
    if (document.querySelector('#teraComparisonStyles')) return;
    const style = document.createElement('style');
    style.id = 'teraComparisonStyles';
    style.textContent = `
      .matchup-state{margin-top:10px;padding:10px 11px;border:1px solid rgba(0,0,0,.08);border-radius:12px;background:rgba(255,255,255,.55)}
      .matchup-state.tera-state{border-style:dashed;background:rgba(255,255,255,.78)}
      .matchup-state-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}
      .matchup-state-label{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.04em;color:#666;margin-bottom:5px}
      .matchup-state.tera-state .matchup-state-label{color:#7a4aa0}
      .tera-comparison-note{font-size:11px;color:#777;margin-top:7px}
      @media (max-width:720px){.matchup-state-head{align-items:flex-start}.matchup-state .best-multiplier{white-space:nowrap}}
    `;
    document.head.appendChild(style);
  }

  window.renderTeamAnalysis = function renderTeamAnalysis(){
    ensureComparisonStyles();
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
            const baseTypes = Array.isArray(record.types) ? record.types.filter(Boolean) : [];
            const baseAnalysis = analyzeHits(opponentMoves, baseTypes, matchup);
            const teraType = record.teraType || '';
            const teraTypes = teraType ? [teraType] : [];
            const teraAnalysis = teraType ? analyzeHits(opponentMoves, teraTypes, matchup) : null;
            const chipRenderer = hit => `<span class="hit-chip">상대 ${hit.index+1} ${escapeHtml(hit.opponent.name)} · ${escapeHtml(hit.moveName)} <small>${escapeHtml(hit.moveType)}</small></span>`;
            return `<article class="opponent-coverage-card defense-coverage-card">
              <div class="opponent-coverage-head">
                <div><span class="opponent-index">내 포켓몬</span><strong>${escapeHtml(record.nickname || record.species)}</strong></div>
              </div>
              ${stateBlock('기본 타입', baseTypes, baseAnalysis, chipRenderer, false)}
              ${teraType ? stateBlock('테라스탈 후', teraTypes, teraAnalysis, chipRenderer, true) : ''}
              ${teraType ? '<div class="tera-comparison-note">테라 타입이 지정되어 있어 기본 상태와 테라스탈 후를 함께 표시합니다.</div>' : ''}
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
            const baseAnalysis = analyzeHits(teamMoves, types, matchup);
            const teraType = opponent.teraType || '';
            const teraTypes = teraType ? [teraType] : [];
            const teraAnalysis = teraType ? analyzeHits(teamMoves, teraTypes, matchup) : null;
            const chipRenderer = hit => `<span class="hit-chip">${escapeHtml(hit.record.nickname || hit.record.species)} · ${escapeHtml(hit.moveName)} <small>${escapeHtml(hit.moveType)}</small></span>`;
            return `<article class="opponent-coverage-card">
              <div class="opponent-coverage-head">
                <div><span class="opponent-index">상대 ${index+1}</span><strong>${escapeHtml(opponent.name)}</strong></div>
              </div>
              ${stateBlock('기본 타입', types, baseAnalysis, chipRenderer, false)}
              ${teraType ? stateBlock('테라스탈 후', teraTypes, teraAnalysis, chipRenderer, true) : ''}
              ${teraType ? '<div class="tera-comparison-note">상대 테라 타입이 선택되어 있어 두 상태의 공격 배율을 함께 표시합니다.</div>' : ''}
            </article>`;
          }).join('');

    const leadHtml = battle.battleFormat === 'double' ? `<div class="lead-analysis"><strong>선봉</strong><span>${battle.leadIndices.length ? battle.leadIndices.map(index => {const record=pokemon.find(item=>item.id===battle.myTeam[index]); return record ? escapeHtml(record.nickname || record.species) : '';}).filter(Boolean).join(' + ') : '아직 지정하지 않았어요'}</span><small>${battle.leadIndices.length}/2</small></div>` : '';

    container.innerHTML = `${leadHtml}<div class="team-analysis-grid">
      <section class="team-analysis-card"><div class="team-analysis-head"><span>DEFENSE</span><h3>팀 방어 약점</h3></div>${defenseHtml}<p class="analysis-caption">상대 팀의 실제 공격 기술을 내 포켓몬에 적용해 계산해요. 내 포켓몬에 테라 타입이 있으면 기본 타입과 테라스탈 후를 모두 표시합니다. 변화 기술은 제외합니다.</p></section>
      <section class="team-analysis-card"><div class="team-analysis-head"><span>OFFENSE</span><h3>상대 팀 공격 커버리지</h3></div>${opponentCoverageHtml}<p class="analysis-caption">내 팀의 실제 공격 기술을 상대에게 적용해 계산해요. 상대 테라 타입이 선택되어 있으면 기본 타입과 테라스탈 후를 모두 표시합니다.</p></section>
    </div>`;

    window.EeveeBoxTypeColors?.repaint?.();
    window.EeveeBoxMoveCategoryColors?.repaint?.();
  };

  const rerender = () => {
    try { if (typeof battle !== 'undefined' && document.querySelector('#teamAnalysis')) window.renderTeamAnalysis(); } catch (_) {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(rerender, 0), {once:true});
  else setTimeout(rerender, 0);
})();
