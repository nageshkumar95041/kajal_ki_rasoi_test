import { Suspense } from 'react';
import SubscriptionClient from './SubscriptionClient';

export const dynamic = 'force-dynamic';

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
      <SubscriptionClient />
    </Suspense>
  );
}