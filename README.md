# Eevee Box

개인용 포켓몬 데이터베이스 · Supabase-only 버전입니다.

## 데이터 구조

- `ebox_pokemon`: 내 포켓몬
- `ebox_battles`: 저장한 3:3 배틀
- `ebox_species_master`: 포켓몬 종류, 타입, 기본 능력치, 종별 특성 후보, 종별 학습 가능 기술
- `ebox_moves_master`: 전체 기술 마스터
- `ebox_items_master`: 전체 도구 마스터
- `ebox_abilities_master`: 전체 특성 마스터

브라우저 JSON 및 localStorage 폴백은 사용하지 않습니다.

## 이번 전환 적용

1. Supabase SQL Editor에서 `supabase-only-migration.sql`을 한 번 실행합니다.
2. `app.js`, `battle.js`, `supabase-data.js`, `index.html`, `battle.html`, `README.md`를 GitHub에 덮어씁니다.
3. GitHub Pages 배포 후 메인 화면과 3:3 배틀을 확인합니다.
4. 정상 동작을 확인한 뒤 아래 구형 파일을 삭제합니다.

### 삭제 가능

- `Code.gs`
- `config.js`
- `abilities.json`
- `items.json`
- `moves.json`
- `owned-tms.json`
- `pokemon-base-stats-by-name.json`
- `pokemon-catalog.json`
- `pokemon-data.json`
- `README-SUPABASE.md`
- `supabase-setup.sql` — 이미 DB 설정을 끝냈다면 런타임에는 필요하지 않습니다.

## 학습 가능 기술

기존 `pokemon-data.json`에 실제로 들어 있던 23종의 학습 가능 기술 목록만 `ebox_species_master.learnable_moves`로 이관합니다. 그 데이터가 없는 종은 임의로 전체 기술을 학습 가능 기술로 표시하지 않습니다. 현재 기술 4개 선택 드롭다운은 전체 기술 마스터를 사용합니다.
