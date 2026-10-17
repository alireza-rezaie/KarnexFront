import { members, pricingPlans, projects, roles, sprints, tasks } from '@/test/fixtures/mockData'

// Explicit test-runtime adapter. Production code never imports this module.
const projectsWithExplicitRoles = projects.map((project) => ({
  ...project,
  memberRoles: ({
    p1: { m1: 'pm', m2: 'dev', m3: 'dev', m6: 'dev' },
    p2: { m1: 'pm', m4: 'dev', m5: 'dev', m6: 'dev' },
    p3: { m2: 'pm', m4: 'dev', m6: 'dev', m8: 'dev' },
    p4: { m3: 'pm', m7: 'dev' },
  } as Record<string, Record<string, string>>)[project.id] ?? {},
}))

Object.assign(globalThis, {
  __karnexTestFixtures: {
    members,
    projects: projectsWithExplicitRoles,
    roles,
    sprints,
    tasks,
    plans: pricingPlans,
    teams: [
      { id: 'team-development', name: 'تیم توسعه', description: 'توسعه و نگهداری پلتفرم و قابلیت‌های اصلی محصول', leadId: 'm1', memberIds: ['m1'], activity: 'امروز ۱۰:۴۲', tone: 'blue' },
      { id: 'team-design', name: 'تیم طراحی', description: 'طراحی تجربه کاربری و رابط کاربری محصول', memberIds: [], activity: 'دیروز ۱۵:۲۰', tone: 'purple' },
      { id: 'team-quality', name: 'تیم تست', description: 'تست کیفیت، اتوماسیون و تضمین عملکرد سیستم', memberIds: [], activity: '۲ روز پیش', tone: 'green' },
    ],
  },
})
