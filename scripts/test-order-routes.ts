/**
 * Order and delivery authorization contract.
 *
 * Static assertions prove the mounted HTTP route obtains identity from JWT
 * middleware and forwards it into the shared service. The focused service test
 * uses a minimal repository double to verify provider ownership and lifecycle
 * behavior without relying on development seed availability.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

async function main() {
  const routeSource = await fs.readFile(new URL('../src/routes/orderRoutes.ts', import.meta.url), 'utf8');
  assert.match(routeSource, /authenticateUser/, 'orderRoutes must use authenticateUser');
  assert.match(routeSource, /req\.user\?\.phone|sessionPhone/, 'identity from JWT session');
  assert.match(routeSource, /updateDeliveryStatus\(orderId, String\(status\), phone/, 'delivery service must receive the authenticated actor');
  assert.match(routeSource, /DeliveryAuthorizationError/, 'delivery ownership failures must be explicit');
  assert.match(routeSource, /DeliveryStateError/, 'delivery lifecycle failures must be explicit');
  assert.doesNotMatch(routeSource, /\+2348030000000/, 'no demo phone');
  assert.doesNotMatch(
    routeSource,
    /const\s+phone\s*=\s*\(req\.query\.phone as string\)\s*\|\|/,
    'must not default identity from query.phone',
  );
  assert.doesNotMatch(routeSource, /router\.(get|post)\('\/api\//, 'router paths must remain relative to the /api composition mount');

  const {
    DeliveryAuthorizationError,
    DeliveryStateError,
    updateDeliveryStatus,
  } = await import('../src/services/deliveryService.js');
  const order = {
    id: 'order-route-test',
    phone: '+2347000000101',
    provider_phone: '+2347000000102',
    status: 'escrow_held',
  };
  const repository = {
    prepare: () => ({
      bind: () => undefined,
      step: () => true,
      getAsObject: () => ({ ...order }),
      free: () => undefined,
    }),
    run: (query: string, values: unknown[]) => {
      if (query.startsWith('UPDATE orders SET status')) order.status = String(values[0]);
    },
  };

  await assert.rejects(
    () => updateDeliveryStatus(order.id, 'driver_assigned', order.phone, undefined, repository),
    DeliveryAuthorizationError,
    'customer must not update provider-driven delivery status',
  );
  await assert.rejects(
    () => updateDeliveryStatus(order.id, 'driver_assigned', '+2347000000103', undefined, repository),
    DeliveryAuthorizationError,
    'unrelated user must not update delivery status',
  );

  const updated = await updateDeliveryStatus(order.id, 'driver_assigned', order.provider_phone, undefined, repository);
  assert.equal(updated.success, true, 'assigned provider should advance the next state');
  assert.equal(updated.status, 'driver_assigned', 'service returns the persisted state');
  assert.equal(order.status, 'driver_assigned', 'valid provider transition must persist');

  await assert.rejects(
    () => updateDeliveryStatus(order.id, 'delivered', order.provider_phone, undefined, repository),
    DeliveryStateError,
    'provider cannot skip delivery lifecycle states',
  );
  assert.equal(order.status, 'driver_assigned', 'invalid transition must not mutate order status');

  console.log('test-order-routes: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
