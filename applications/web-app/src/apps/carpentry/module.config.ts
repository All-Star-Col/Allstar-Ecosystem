import { lazy } from 'react';
import type { AppModule } from '@/core/types';

export const CarpentryModule: AppModule = {
  name: 'carpentry',
  title: 'Carpintería',
  path: '/app/carpentry',
  icon: 'hammer',
  component: lazy(() => import('./App')),
};
