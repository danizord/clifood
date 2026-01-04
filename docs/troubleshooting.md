# Troubleshooting

## "Not logged in" or missing address

Run:

```bash
bun src/cli.ts open --wait
```

Log in and select a delivery address in the opened browser, then retry the command.

## Anti-bot challenge

If iFood shows a “click and hold” modal, complete it once in the browser session. The CLI will reuse that session for future calls.

## Empty search results

Use `--top` to rely on the discovery feed instead of search, or try a more specific query.

## Menu item not found

Use `bun src/cli.ts items --restaurant "..." --query "..."` to see the exact catalog item names and match those in your `order` command.
