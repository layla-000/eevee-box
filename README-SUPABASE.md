# Eevee Box · Supabase refactor

## What changed
- Google Apps Script / Google Sheets sync was replaced by Supabase Auth + database sync.
- Existing browser data is preserved as an offline cache.
- On the first successful Supabase login, if `ebox_pokemon` is empty, the current local/seed Pokémon records are uploaded automatically.
- Existing local 3:3 battle saves are also migrated when the cloud battle table is empty.
- Pokémon cards now show defensive type matchups, including ×4 / ×2 weaknesses, immunities, and 1/2 / 1/4 resistances for dual types.
- Separate master tables are prepared for species, moves, abilities, and held items. The current JSON files remain the active reference source until the canonical lists are provided.

## First deployment
1. Open the shared Supabase project used by Dolly Box.
2. Run `supabase-setup.sql` once in SQL Editor.
3. Run `supabase-species-seed.sql` to import the 1,187 user-provided Pokémon species/forms and type data.
4. Run `supabase-moves-seed.sql` to import the 903 user-provided move records.
5. Confirm the account you use for Dolly/Cosmetic Box exists in Authentication > Users.
6. Commit the modified/new files to the Eevee Box GitHub Pages repository.
7. Open Eevee Box and sign in. Existing local Pokémon data will be copied to Supabase automatically if the table is empty.

## Files that can be retired later
- `Code.gs` is no longer used by the web app.
- When canonical master lists are supplied, `pokemon-catalog.json`, `moves.json`, `abilities.json`, and `items.json` can be imported into the prepared `ebox_*_master` tables and the UI can switch from JSON fetches to Supabase master queries.


## Species master
- `ebox_species_master` stores Pokédex number, unique form/name, type 1, type 2, and the supplied classification (메인전설/준전설/환상/고대폼/미래폼).
- The app loads this Supabase table first for the species picker and automatic type entry, while bundled JSON remains as a fallback and as the temporary source of base stats/ability mapping.


## Move master
- `ebox_moves_master` now stores move name, type, category, effect/description, learn method, learn level, power, accuracy, PP, and priority as first-class columns.
- The app loads the Supabase move master first for move detail/search data and falls back to bundled `moves.json` only if the cloud master cannot be read.
- The supplied source contains 903 unique move names. Blank or special values such as `-`, `—`, and `-%` are preserved as text rather than guessed or normalized away.

## 도구 마스터 업데이트

사용자가 제공한 도구 134종을 `ebox_items_master`에 넣을 수 있도록 `supabase-items-seed.sql`을 추가했습니다.

1. 최신 `supabase-setup.sql` 실행
2. `supabase-items-seed.sql` 실행
3. 앱 새로고침

이후 편집 화면의 지닌 도구 목록/효과/가격/보유 제한은 Supabase 마스터를 우선 사용합니다. Supabase 조회 실패 시에는 기존 `items.json`으로 폴백합니다.
`featured`는 원본 표의 TRUE/FALSE 값을 그대로 보존합니다.


## Ability master update

Run `supabase-setup.sql` first, then run `supabase-abilities-seed.sql`.
The ability seed preserves the user-provided row order, duplicate ability names, and blank descriptions. The app groups duplicate names for selection and combines distinct descriptions when needed. Supabase is preferred; bundled `abilities.json` remains as a fallback.
