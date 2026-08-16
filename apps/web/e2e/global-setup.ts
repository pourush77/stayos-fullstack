import { assertE2EInventoryCounts, ensureE2EPropertyFixture, resetE2ETransactionalData } from './helpers/e2e-db';

async function globalSetup() {
  ensureE2EPropertyFixture();
  resetE2ETransactionalData();
  assertE2EInventoryCounts();
}

export default globalSetup;
