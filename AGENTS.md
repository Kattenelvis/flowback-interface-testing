# Agent guidelines

## Multi-user test setup

When a test needs several users, open all windows first, then register each one. Name pages `<letter>Page` and the user `<letter>`, register every user into a variable, and don't add comments describing each user's role.

Do this:

```ts
const bPage = await newWindow()
const cPage = await newWindow()
const dPage = await newWindow()

const c = await register(cPage)
const b = await register(bPage)
const d = await register(dPage)
```

Not this:

```ts
// X: delegate who self-delegates, then overrides it with a personal vote
// Y: delegate who self-delegates and has Z delegating to them
// W: delegate without voting rights who self-delegates
const yPage = await newWindow()
const zPage = await newWindow()
const wPage = await newWindow()

const x = await register(page)
const y = await register(yPage)
await register(zPage)
const w = await register(wPage)
```
