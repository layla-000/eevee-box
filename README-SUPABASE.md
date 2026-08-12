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
3. Confirm the account you use for Dolly/Cosmetic Box exists in Authentication > Users.
4. Commit the modified/new files to the Eevee Box GitHub Pages repository.
5. Open Eevee Box and sign in. Existing local Pokémon data will be copied to Supabase automatically if the table is empty.

## Files that can be retired later
- `Code.gs` is no longer used by the web app.
- When canonical master lists are supplied, `pokemon-catalog.json`, `moves.json`, `abilities.json`, and `items.json` can be imported into the prepared `ebox_*_master` tables and the UI can switch from JSON fetches to Supabase master queries.
