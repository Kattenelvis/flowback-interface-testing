import test from './fixtures'
import { login } from "./generic"
import { deleteGroup, gotoFirstGroup } from "./group"

test('Delete-Many-Groups', async ({ page }) => {
  test.skip()
  await login(page)
  for (let i = 0; i < 50; i++) {
    await gotoFirstGroup(page)
    await deleteGroup(page)
  }
})
