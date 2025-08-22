import { initPlasmicLoader } from '@plasmicapp/loader-react';
import SectionHeader from '../components/SectionHeader';
import FinalCTA from '../components/FinalCTA';
import CounterReveal from '../components/CounterReveal';
import WorkflowList from '../components/WorkflowList';
import Wordmark from '../components/Wordmark';
import FloralBackdrop from '../components/FloralBackdrop';
import LandingV2 from '../pages/LandingV2';
import HeroSection from '../components/HeroSection';

const PROJECT_ID = import.meta.env.VITE_PLASMIC_PROJECT_ID as string | undefined;
const PUBLIC_TOKEN = import.meta.env.VITE_PLASMIC_PUBLIC_TOKEN as string | undefined;

export const PLASMIC = PROJECT_ID && PUBLIC_TOKEN
  ? initPlasmicLoader({ projects: [{ id: PROJECT_ID, token: PUBLIC_TOKEN }] })
  : null as any;

if (PLASMIC) {
  try {
    PLASMIC.registerComponent(SectionHeader, {
      name: 'SectionHeader',
      classNameProp: 'className',
      styleSections: true,
      props: {
        eyebrow: 'string',
        title: 'string',
        subtitle: 'string',
        align: { type: 'choice', options: ['left','center'], defaultValue: 'left' },
        className: 'string',
      },
    });
    PLASMIC.registerComponent(WorkflowList, {
      name: 'WorkflowList',
      classNameProp: 'className',
      styleSections: true,
      props: {
        items: 'object',
        columns: { type: 'number', defaultValue: 2 },
        className: 'string',
      },
      defaultStyles: { width: '100%' },
    });
    PLASMIC.registerComponent(CounterReveal, {
      name: 'CounterReveal',
      classNameProp: 'className',
      styleSections: true,
      props: {
        label: 'string',
        value: 'number',
        durationMs: 'number',
        align: { type: 'choice', options: ['left','center'], defaultValue: 'center' },
        className: 'string',
      },
    });
    PLASMIC.registerComponent(FinalCTA, {
      name: 'FinalCTA',
      classNameProp: 'className',
      styleSections: true,
      props: {
        label: 'string',
        sublabel: 'string',
        href: 'string',
        align: { type: 'choice', options: ['left','center'], defaultValue: 'center' },
        className: 'string',
      },
    });

    PLASMIC.registerComponent(Wordmark, {
      name: 'Wordmark',
      classNameProp: 'className',
      styleSections: true,
      props: { className: 'string' },
      defaultStyles: { width: 'auto' },
    });

    PLASMIC.registerComponent(FloralBackdrop, {
      name: 'FloralBackdrop',
      classNameProp: 'className',
      styleSections: true,
      props: {
        navy: { type: 'boolean', defaultValue: false },
        density: { type: 'choice', options: ['low','med','high'], defaultValue: 'med' },
        borderless: { type: 'boolean', defaultValue: true },
        opacity: { type: 'number', defaultValue: 0.95 },
        randomize: { type: 'boolean', defaultValue: true },
        className: 'string',
      },
      defaultStyles: { width: '100%', height: '180px' },
    });

    PLASMIC.registerComponent(HeroSection, {
      name: 'HeroSection',
      classNameProp: 'className',
      styleSections: true,
      props: {
        eyebrow: 'string',
        title: 'string',
        subtitle: 'string',
        ctaLabel: 'string',
        ctaHref: 'string',
        ctaOffsetY: { type: 'number', defaultValue: 200 },
        haloColor: { type: 'choice', options: ['blue','pink'], defaultValue: 'blue' },
        haloIntensity: { type: 'number', defaultValue: 0.7 },
        className: 'string',
      },
      defaultStyles: { width: '100%' },
    });

    // Expose the full landing composition for preview in Studio
    PLASMIC.registerComponent(LandingV2 as any, {
      name: 'BrandVXLanding',
      props: {},
    });
  } catch {}
}


