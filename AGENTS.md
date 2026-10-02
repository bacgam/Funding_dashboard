# UI conventions

- Use the shared theme variables in `public/styles.css`: green `#59CD78` (`--accent` / `--positive`) and pink `#FF707D` (`--negative`). Apply these consistently to all views, including charts and dialogs. Keep original brand artwork colors.
- Center every exchange table header in its column, including future exchanges. Use `th[data-column]` with an `.exchange-heading` wrapper for the logo and name. Omit settlement currency labels (USDT0, USDC, etc.) from table headers and keep the header row compact (52px). Do not add exchange-specific alignment or left offsets.
- Keep the sidebar width fixed when groups expand or collapse. Its scrollbar stays hidden while wheel and touch scrolling remain available.
