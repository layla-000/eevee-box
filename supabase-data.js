(() => {
  const client = window.EeveeSupabase;

  function throwIf(error){ if(error) throw error; }
  async function user(){
    const {data,error} = await client.auth.getUser();
    throwIf(error);
    if(!data.user) throw new Error('로그인이 필요해요.');
    return data.user;
  }

  function rowToRecord(row){
    return {
      id: row.id,
      order: row.sort_order ?? 99,
      nickname: row.nickname || '',
      species: row.species || '',
      level: row.level || 1,
      types: row.types || [],
      ability: row.ability || '',
      abilityEffect: row.ability_effect || '',
      teraType: row.tera_type || '',
      nature: row.nature || '',
      heldItem: row.held_item || '',
      notes: row.notes || '',
      currentMoves: row.current_moves || [],
      moves: row.learnable_moves || [],
      stats: row.stats || {},
      updatedAt: row.updated_at || ''
    };
  }

  function recordToRow(record, ownerId){
    return {
      id: record.id,
      owner_id: ownerId,
      sort_order: Number(record.order || 99),
      nickname: record.nickname || null,
      species: record.species || '',
      level: Math.max(1, Math.min(100, Number(record.level || 1))),
      types: record.types || [],
      ability: record.ability || null,
      ability_effect: record.abilityEffect || null,
      tera_type: record.teraType || null,
      nature: record.nature || null,
      held_item: record.heldItem || null,
      notes: record.notes || null,
      current_moves: record.currentMoves || [],
      learnable_moves: record.moves || [],
      stats: record.stats || {},
      updated_at: new Date().toISOString()
    };
  }

  async function getAll(){
    await user();
    const {data,error} = await client.from('ebox_pokemon').select('*').order('sort_order');
    throwIf(error);
    return (data || []).map(rowToRecord);
  }

  async function saveRecord(record){
    const u = await user();
    const row = recordToRow(record, u.id);
    const {data,error} = await client.from('ebox_pokemon').upsert(row, {onConflict:'id'}).select('*').single();
    throwIf(error);
    return rowToRecord(data);
  }

  async function syncAll(records){
    const u = await user();
    const remote = await getAll();
    if(!remote.length && records?.length){
      const rows = records.map(record => recordToRow(record, u.id));
      const {data,error} = await client.from('ebox_pokemon').upsert(rows, {onConflict:'id'}).select('*');
      throwIf(error);
      return (data || []).map(rowToRecord);
    }
    return remote;
  }

  async function removeRecord(id){
    await user();
    const {error} = await client.from('ebox_pokemon').delete().eq('id', id);
    throwIf(error);
  }

  async function listBattles(){
    await user();
    const {data,error} = await client.from('ebox_battles').select('id,title,battle,updated_at').order('updated_at',{ascending:false});
    throwIf(error);
    return (data || []).map(row => ({...(row.battle || {}), id:row.id, title:row.title || row.battle?.title || '', updatedAt:row.updated_at}));
  }

  async function saveBattle(battle){
    const u = await user();
    const next = {...battle, updatedAt:new Date().toISOString()};
    const {data,error} = await client.from('ebox_battles').upsert({
      id: next.id,
      owner_id: u.id,
      title: next.title || '',
      battle: next,
      updated_at: next.updatedAt
    }, {onConflict:'id'}).select('*').single();
    throwIf(error);
    return {...(data.battle || next), id:data.id, title:data.title, updatedAt:data.updated_at};
  }

  async function renameBattle(id, title){
    await user();
    const {data:row,error:readError} = await client.from('ebox_battles').select('*').eq('id',id).single();
    throwIf(readError);
    const battle = {...(row.battle || {}), id, title, updatedAt:new Date().toISOString()};
    const {data,error} = await client.from('ebox_battles').update({title,battle,updated_at:battle.updatedAt}).eq('id',id).select('*').single();
    throwIf(error);
    return {...data.battle, id:data.id, title:data.title, updatedAt:data.updated_at};
  }

  async function deleteBattle(id){
    await user();
    const {error} = await client.from('ebox_battles').delete().eq('id',id);
    throwIf(error);
  }

  async function api(action, payload={}){
    switch(action){
      case 'sync_all': return {ok:true, records:await syncAll(payload.records || [])};
      case 'get_all': return {ok:true, records:await getAll()};
      case 'save': return {ok:true, record:await saveRecord(payload.record)};
      case 'remove': await removeRecord(payload.id); return {ok:true};
      case 'list_battles': return {ok:true, battles:await listBattles()};
      case 'save_battle': return {ok:true, battle:await saveBattle(payload.battle)};
      case 'rename_battle': return {ok:true, battle:await renameBattle(payload.id,payload.title)};
      case 'delete_battle': await deleteBattle(payload.id); return {ok:true};
      default: throw new Error(`Unknown Supabase action: ${action}`);
    }
  }

  window.EeveeBackend = {client, api, getAll, saveRecord, removeRecord, listBattles};
})();
