const { CloudBillingClient } = require('@google-cloud/billing');

const billing = new CloudBillingClient();

const PROJECT_ID = process.env.PROJECT_ID;
const KILL_THRESHOLD_USD = parseFloat(process.env.KILL_THRESHOLD_USD || '32');
const SIMULATE = process.env.SIMULATE === 'true';

/**
 * Cloud Run Function triggered by GCP billing budget Pub/Sub messages.
 * Detaches billing from the project when costAmount >= KILL_THRESHOLD_USD.
 *
 * @param {object} cloudEvent - CloudEvent with Pub/Sub message data
 */
exports.handleBillingAlert = async (cloudEvent) => {
  // Decode base64 Pub/Sub message
  const rawData = cloudEvent.data?.message?.data;
  if (!rawData) {
    console.error('No message data received');
    return;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(rawData, 'base64').toString());
  } catch (err) {
    console.error('Failed to parse Pub/Sub message:', err.message);
    return;
  }

  const { costAmount, budgetAmount } = payload;
  console.log(`Budget alert received: costAmount=$${costAmount}, budgetAmount=$${budgetAmount}`);

  if (costAmount < KILL_THRESHOLD_USD) {
    console.log(`costAmount $${costAmount} is below kill threshold $${KILL_THRESHOLD_USD} — no action taken`);
    return;
  }

  const projectName = `projects/${PROJECT_ID}`;

  if (SIMULATE) {
    console.log(`SIMULATE mode: would detach billing from project ${PROJECT_ID}`);
    console.log(`SIMULATE mode: would call billing.updateProjectBillingInfo({ name: '${projectName}', resource: { billingAccountName: '' } })`);
    return;
  }

  // Check if billing is already disabled to avoid redundant API calls
  try {
    const [projectBillingInfo] = await billing.getProjectBillingInfo({ name: projectName });

    if (!projectBillingInfo.billingEnabled) {
      console.log(`Billing is already disabled for project ${PROJECT_ID} — no action needed`);
      return;
    }
  } catch (err) {
    console.error(`Failed to check billing status for ${PROJECT_ID}:`, err.message);
    return;
  }

  // Detach billing account from the project
  try {
    const [result] = await billing.updateProjectBillingInfo({
      name: projectName,
      resource: { billingAccountName: '' },
    });
    console.log(`Billing successfully detached from project ${PROJECT_ID}`);
    console.log('Result:', JSON.stringify(result));
  } catch (err) {
    console.error(`Failed to detach billing from ${PROJECT_ID}:`, err.message);
    throw err; // Re-throw so Cloud Run marks the invocation as failed
  }
};
