const SHEET_NAME = 'Pokemon';
const BATTLE_SHEET_NAME = 'Battle Saves';

function doGet(){
  return json_({ok:true,message:'Eevee Box API'});
}

function doPost(e){
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    switch (body.action){
      case 'get_all': return getAll_();
      case 'save': return save_(body.record);
      case 'remove': return remove_(body.id);
      case 'seed': return seed_(body.records || []);
      case 'sync_all': return syncAll_(body.records || []);
      case 'list_battles': return listBattles_();
      case 'get_battle': return getLatestBattle_(); // 이전 프런트 호환
      case 'save_battle': return saveBattle_(body.battle);
      case 'rename_battle': return renameBattle_(body.id, body.title);
      case 'delete_battle': return deleteBattle_(body.id);
      default: throw new Error('Unknown action: ' + body.action);
    }
  } catch (err){
    return json_({ok:false,error:String(err.message || err)});
  }
}

function sheet_(){
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh){
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['id','json','updatedAt']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function readRecords_(){
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2,1,last-1,3).getValues().map(row => {
    try { return JSON.parse(row[1]); }
    catch (_) { return null; }
  }).filter(Boolean);
}

function getAll_(){
  return json_({ok:true,records:readRecords_()});
}

function save_(record){
  if (!record || !record.id) throw new Error('record.id is required');
  const sh = sheet_();
  const last = sh.getLastRow();
  const ids = last < 2 ? [] : sh.getRange(2,1,last-1,1).getValues().flat();
  const idx = ids.indexOf(record.id);
  const row = idx < 0 ? last + 1 : idx + 2;
  record.updatedAt = new Date().toISOString();
  sh.getRange(row,1,1,3).setValues([[record.id,JSON.stringify(record),record.updatedAt]]);
  return json_({ok:true,record});
}

function remove_(id){
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last >= 2){
    const ids = sh.getRange(2,1,last-1,1).getValues().flat();
    const idx = ids.indexOf(id);
    if (idx >= 0) sh.deleteRow(idx + 2);
  }
  return json_({ok:true});
}

function seed_(records){
  const sh = sheet_();
  if (sh.getLastRow() > 1) return getAll_();
  writeAll_(records);
  return json_({ok:true,count:records.length,records});
}

function syncAll_(clientRecords){
  const remoteRecords = readRecords_();
  const merged = {};
  remoteRecords.concat(clientRecords).forEach(record => {
    if (!record || !record.id) return;
    const old = merged[record.id];
    const oldTime = old ? Date.parse(old.updatedAt || 0) : -1;
    const newTime = Date.parse(record.updatedAt || 0);
    if (!old || newTime >= oldTime) merged[record.id] = record;
  });
  const records = Object.keys(merged).map(id => merged[id]);
  writeAll_(records);
  return json_({ok:true,records});
}

function writeAll_(records){
  const sh = sheet_();
  if (sh.getLastRow() > 1) sh.getRange(2,1,sh.getLastRow()-1,3).clearContent();
  const rows = records.map(record => {
    record.updatedAt = record.updatedAt || new Date().toISOString();
    return [record.id,JSON.stringify(record),record.updatedAt];
  });
  if (rows.length) sh.getRange(2,1,rows.length,3).setValues(rows);
}

function battleSheet_(){
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(BATTLE_SHEET_NAME);
  if (!sh){
    sh = ss.insertSheet(BATTLE_SHEET_NAME);
    sh.appendRow(['id','title','json','updatedAt']);
    sh.setFrozenRows(1);
  }

  // 예전 Battle 시트 형식을 그대로 이름만 바꿔 쓴 경우를 보정해요.
  if (sh.getLastColumn() < 4){
    sh.insertColumnAfter(sh.getLastColumn());
    sh.getRange(1,1,1,4).setValues([['id','title','json','updatedAt']]);
  }
  return sh;
}

function readBattles_(){
  const sh = battleSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2,1,last-1,4).getValues().map(row => {
    try {
      const battle = JSON.parse(row[2]);
      battle.id = battle.id || row[0];
      battle.title = battle.title || row[1] || '';
      battle.updatedAt = battle.updatedAt || row[3] || '';
      return battle;
    } catch (_) {
      return null;
    }
  }).filter(Boolean).sort((a,b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
}

function listBattles_(){
  return json_({ok:true,battles:readBattles_()});
}

function getLatestBattle_(){
  const battles = readBattles_();
  return json_({ok:true,battle:battles[0] || null});
}

function saveBattle_(battle){
  if (!battle) throw new Error('battle is required');
  if (!battle.id) throw new Error('battle.id is required');
  if (!String(battle.title || '').trim()) throw new Error('battle.title is required');

  const lock = LockService.getDocumentLock();
  lock.waitLock(10000);
  try {
    const sh = battleSheet_();
    const last = sh.getLastRow();
    const ids = last < 2 ? [] : sh.getRange(2,1,last-1,1).getValues().flat();
    const idx = ids.indexOf(battle.id);
    const row = idx < 0 ? last + 1 : idx + 2;
    battle.title = String(battle.title).trim();
    battle.updatedAt = new Date().toISOString();
    sh.getRange(row,1,1,4).setValues([[battle.id,battle.title,JSON.stringify(battle),battle.updatedAt]]);
    return json_({ok:true,battle});
  } finally {
    lock.releaseLock();
  }
}

function renameBattle_(id, title){
  if (!id) throw new Error('id is required');
  title = String(title || '').trim();
  if (!title) throw new Error('title is required');

  const sh = battleSheet_();
  const last = sh.getLastRow();
  if (last < 2) throw new Error('Battle not found');
  const ids = sh.getRange(2,1,last-1,1).getValues().flat();
  const idx = ids.indexOf(id);
  if (idx < 0) throw new Error('Battle not found');

  const row = idx + 2;
  const battle = JSON.parse(sh.getRange(row,3).getValue());
  battle.title = title;
  battle.updatedAt = new Date().toISOString();
  sh.getRange(row,1,1,4).setValues([[id,title,JSON.stringify(battle),battle.updatedAt]]);
  return json_({ok:true,battle});
}

function deleteBattle_(id){
  if (!id) throw new Error('id is required');
  const sh = battleSheet_();
  const last = sh.getLastRow();
  if (last >= 2){
    const ids = sh.getRange(2,1,last-1,1).getValues().flat();
    const idx = ids.indexOf(id);
    if (idx >= 0) sh.deleteRow(idx + 2);
  }
  return json_({ok:true,id});
}

function json_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
