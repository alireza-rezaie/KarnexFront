// // Karnex Mock Data - Persian Project Management System

// import type { Activity } from '@/types/activity';
// import type { Member } from '@/types/member';
// import type { Plan } from '@/types/plan';
// import type { Project } from '@/types/project';
// import type { Role } from '@/types/role';
// import type { Sprint } from '@/types/sprint';
// import type { Task } from '@/types/task';

// // Members
// export const members: Member[] = [
//   { id: 'm1', name: 'علی احمدی', email: 'ali@karnex.ir', jobTitle: 'مدیر پروژه', roleId: 'pm', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ali', status: 'online', projects: ['p1', 'p2'], lastActivity: '20 دقیقه پیش' },
//   { id: 'm2', name: 'سارا محمدی', email: 'sara@karnex.ir', jobTitle: 'توسعه‌دهنده ارشد', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sara', status: 'online', projects: ['p1', 'p3'], lastActivity: '5 دقیقه پیش' },
//   { id: 'm3', name: 'رضا کریمی', email: 'reza@karnex.ir', jobTitle: 'طراح UI/UX', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=reza', status: 'busy', projects: ['p1', 'p4'], lastActivity: '1 ساعت پیش' },
//   { id: 'm4', name: 'مریم حسینی', email: 'maryam@karnex.ir', jobTitle: 'توسعه‌دهنده فرانت', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=maryam', status: 'online', projects: ['p2', 'p3'], lastActivity: '10 دقیقه پیش' },
//   { id: 'm5', name: 'حسین رضایی', email: 'hossein@karnex.ir', jobTitle: 'توسعه‌دهنده بک‌اند', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=hossein', status: 'offline', projects: ['p2'], lastActivity: '3 ساعت پیش' },
//   { id: 'm6', name: 'نیلوفر صادقی', email: 'niloofar@karnex.ir', jobTitle: 'تستر نرم‌افزار', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=niloofar', status: 'online', projects: ['p1', 'p2', 'p3'], lastActivity: '15 دقیقه پیش' },
//   { id: 'm7', name: 'امیر حاجی‌زاده', email: 'amir@karnex.ir', jobTitle: 'مدیر محصول', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=amir', status: 'busy', projects: ['p4'], lastActivity: '30 دقیقه پیش' },
//   { id: 'm8', name: 'فاطمه نوری', email: 'fatemeh@karnex.ir', jobTitle: 'توسعه‌دهنده موبایل', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=fatemeh', status: 'offline', projects: ['p3'], lastActivity: '5 ساعت پیش' },
// ];

// // Projects
// export const projects: Project[] = [
//   { id: 'p1', key: 'WEB', name: 'بازطراحی وب‌سایت', description: 'بازطراحی کامل وب‌سایت شرکت با تکنولوژی‌های مدرن', type: 'scrum', status: 'active', privacy: 'private', icon: 'globe', color: '#3b82f6', progress: 68, members: ['m1', 'm2', 'm3', 'm6'], sprintId: 's1', startDate: '1403/01/15', endDate: '1403/06/31', tasksCount: 42, completedTasks: 29 },
//   { id: 'p2', key: 'APP', name: 'اپلیکیشن موبایل', description: 'توسعه اپلیکیشن اندروید و iOS برای مشتریان', type: 'scrum', status: 'active', privacy: 'private', icon: 'smartphone', color: '#f97316', progress: 45, members: ['m1', 'm4', 'm5', 'm6'], sprintId: 's2', startDate: '1403/02/01', endDate: '1403/08/30', tasksCount: 56, completedTasks: 25 },
//   { id: 'p3', key: 'CRM', name: 'سیستم مدیریت مشتریان', description: 'پیاده‌سازی سیستم CRM یکپارچه برای تیم فروش', type: 'kanban', status: 'active', privacy: 'public', icon: 'users', color: '#22c55e', progress: 32, members: ['m2', 'm4', 'm6', 'm8'], sprintId: undefined, startDate: '1403/03/10', endDate: '1403/09/30', tasksCount: 34, completedTasks: 11 },
//   { id: 'p4', key: 'EDU', name: 'پلتفرم آموزش آنلاین', description: 'ساخت پلتفرم آموزشی با قابلیت‌های تعاملی', type: 'scrum', status: 'paused', privacy: 'private', icon: 'graduation-cap', color: '#8b5cf6', progress: 15, members: ['m3', 'm7'], sprintId: undefined, startDate: '1403/04/01', endDate: '1403/11/30', tasksCount: 28, completedTasks: 4 },
// ];

// // Sprints
// export const sprints: Sprint[] = [
//   { id: 's1', name: 'اسپرینت 4 - بخش کاربری', goal: 'تکمیل صفحات کاربری و پروفایل', status: 'active', projectId: 'p1', startDate: '1403/04/01', endDate: '1403/04/15', duration: 2 },
//   { id: 's2', name: 'اسپرینت 2 - APIها', goal: 'اتصال APIها و یکپارچه‌سازی', status: 'active', projectId: 'p2', startDate: '1403/04/01', endDate: '1403/04/14', duration: 2 },
//   { id: 's3', name: 'اسپرینت 3 - تست و بهینه‌سازی', goal: 'تست نهایی و رفع باگ‌ها', status: 'planned', projectId: 'p1', startDate: '1403/04/16', endDate: '1403/04/30', duration: 2 },
// ];

// // Tasks
// export const tasks: Task[] = [
//   { id: 't1', key: 'WEB-12', title: 'طراحی صفحه ورود و ثبت‌نام', description: 'طراحی UI صفحات احراز هویت با استانداردهای جدید', type: 'task', status: 'done', priority: 'high', assignee: 'm3', reporter: 'm1', projectId: 'p1', sprintId: 's1', labels: ['UI', 'Auth'], storyPoints: 5, estimatedSeconds: 28800, dueDate: '1403/04/05', createdAt: '1403/03/25', updatedAt: '1403/04/03', comments: 8, attachments: 3, subtasks: 4, completedSubtasks: 4 },
//   { id: 't2', key: 'WEB-13', title: 'اتصال فرم ورود به API', description: 'پیاده‌سازی اتصال فرم ورود به سرویس احراز هویت', type: 'task', status: 'inprogress', priority: 'highest', assignee: 'm2', reporter: 'm1', projectId: 'p1', sprintId: 's1', labels: ['API', 'Auth'], storyPoints: 8, estimatedSeconds: 86400, dueDate: '1403/04/08', createdAt: '1403/03/26', updatedAt: '1403/04/02', comments: 5, attachments: 1, subtasks: 3, completedSubtasks: 2 },
//   { id: 't3', key: 'WEB-14', title: 'پیاده‌سازی داشبورد ادمین', description: 'ساخت داشبورد مدیریت با نمودارها و آمار', type: 'story', status: 'inprogress', priority: 'high', assignee: 'm4', reporter: 'm1', projectId: 'p1', sprintId: 's1', labels: ['Dashboard', 'Admin'], storyPoints: 13, estimatedSeconds: 86400, dueDate: '1403/04/10', createdAt: '1403/03/28', updatedAt: '1403/04/01', comments: 12, attachments: 5, subtasks: 6, completedSubtasks: 3 },
//   { id: 't4', key: 'WEB-15', title: 'ساخت کامپوننت ناوبری', description: 'طراحی و پیاده‌سازی منوی ناوبری واکنش‌گرا', type: 'task', status: 'todo', priority: 'medium', assignee: 'm3', reporter: 'm1', projectId: 'p1', sprintId: 's1', labels: ['UI', 'Navigation'], storyPoints: 5, estimatedSeconds: 28800, dueDate: '1403/04/12', createdAt: '1403/03/30', updatedAt: '1403/04/01', comments: 3, attachments: 2, subtasks: 2, completedSubtasks: 0 },
//   { id: 't5', key: 'WEB-16', title: 'یکپارچه‌سازی درگاه پرداخت', description: 'اتصال درگاه پرداخت زرین‌پال به سیستم', type: 'task', status: 'review', priority: 'highest', assignee: 'm2', reporter: 'm1', projectId: 'p1', sprintId: 's1', labels: ['API', 'Payment'], storyPoints: 8, estimatedSeconds: 86400, dueDate: '1403/04/07', createdAt: '1403/03/25', updatedAt: '1403/04/02', comments: 6, attachments: 2, subtasks: 3, completedSubtasks: 3 },
//   { id: 't6', key: 'WEB-17', title: 'رفع باگ فرم جستجو', description: 'رفع مشکل عدم نمایش نتایج در فرم جستجو', type: 'bug', status: 'todo', priority: 'high', assignee: 'm6', reporter: 'm2', projectId: 'p1', sprintId: 's1', labels: ['Bug', 'Search'], storyPoints: 3, estimatedSeconds: 14400, dueDate: '1403/04/06', createdAt: '1403/04/01', updatedAt: '1403/04/01', comments: 2, attachments: 1, subtasks: 1, completedSubtasks: 0 },
//   { id: 't7', key: 'APP-8', title: 'طراحی صفحه اصلی اپلیکیشن', description: 'طراحی UI صفحه Home اپلیکیشن موبایل', type: 'task', status: 'done', priority: 'high', assignee: 'm3', reporter: 'm1', projectId: 'p2', sprintId: 's2', labels: ['UI', 'Mobile'], storyPoints: 5, estimatedSeconds: 28800, dueDate: '1403/04/04', createdAt: '1403/03/20', updatedAt: '1403/04/02', comments: 4, attachments: 6, subtasks: 3, completedSubtasks: 3 },
//   { id: 't8', key: 'APP-9', title: 'پیاده‌سازی API محصولات', description: 'ساخت اندپوینت‌های CRUD برای محصولات', type: 'task', status: 'inprogress', priority: 'high', assignee: 'm5', reporter: 'm1', projectId: 'p2', sprintId: 's2', labels: ['API', 'Backend'], storyPoints: 8, estimatedSeconds: 86400, dueDate: '1403/04/09', createdAt: '1403/03/22', updatedAt: '1403/04/01', comments: 7, attachments: 1, subtasks: 4, completedSubtasks: 2 },
//   { id: 't9', key: 'APP-10', title: 'تست واحد ماژول سفارشات', description: 'نوشتن تست‌های واحد برای ماژول سفارشات', type: 'task', status: 'todo', priority: 'medium', assignee: 'm6', reporter: 'm1', projectId: 'p2', sprintId: 's2', labels: ['Test', 'Backend'], storyPoints: 5, estimatedSeconds: 28800, dueDate: '1403/04/11', createdAt: '1403/03/25', updatedAt: '1403/03/30', comments: 1, attachments: 0, subtasks: 2, completedSubtasks: 0 },
//   { id: 't10', key: 'APP-11', title: 'بهینه‌سازی عملکرد اپلیکیشن', description: 'بهینه‌سازی لود تصاویر و کش‌گذاری', type: 'story', status: 'todo', priority: 'medium', assignee: 'm4', reporter: 'm1', projectId: 'p2', sprintId: 's2', labels: ['Performance', 'Mobile'], storyPoints: 8, estimatedSeconds: 86400, dueDate: '1403/04/13', createdAt: '1403/03/28', updatedAt: '1403/03/30', comments: 3, attachments: 1, subtasks: 3, completedSubtasks: 0 },
//   { id: 't11', key: 'CRM-5', title: 'طراحی فرم ثبت مشتری', description: 'طراحی فرم جامع ثبت اطلاعات مشتریان', type: 'task', status: 'done', priority: 'high', assignee: 'm3', reporter: 'm2', projectId: 'p3', sprintId: undefined, labels: ['UI', 'Form'], storyPoints: 5, estimatedSeconds: 28800, dueDate: '1403/04/03', createdAt: '1403/03/15', updatedAt: '1403/04/02', comments: 6, attachments: 2, subtasks: 2, completedSubtasks: 2 },
//   { id: 't12', key: 'CRM-6', title: 'ساخت API مدیریت مخاطبین', description: 'پیاده‌سازی CRUD مخاطبین با اعتبارسنجی', type: 'task', status: 'inprogress', priority: 'high', assignee: 'm2', reporter: 'm2', projectId: 'p3', sprintId: undefined, labels: ['API', 'Backend'], storyPoints: 8, estimatedSeconds: 86400, dueDate: '1403/04/08', createdAt: '1403/03/18', updatedAt: '1403/04/01', comments: 4, attachments: 1, subtasks: 3, completedSubtasks: 1 },
//   { id: 't13', key: 'WEB-18', title: 'بهینه‌سازی SEO صفحات', description: 'بهینه‌سازی متا تگ‌ها و ساختار URLها', type: 'task', status: 'todo', priority: 'low', assignee: 'm1', reporter: 'm1', projectId: 'p1', sprintId: undefined, labels: ['SEO', 'Performance'], storyPoints: 3, estimatedSeconds: 14400, dueDate: '1403/04/20', createdAt: '1403/03/29', updatedAt: '1403/03/29', comments: 0, attachments: 0, subtasks: 2, completedSubtasks: 0 },
//   { id: 't14', key: 'WEB-19', title: 'افزودن قابلیت فیلتر پیشرفته', description: 'فیلتر چندمرحله‌ای با قابلیت ذخیره', type: 'story', status: 'todo', priority: 'medium', assignee: 'm4', reporter: 'm1', projectId: 'p1', sprintId: undefined, labels: ['Feature', 'UI'], storyPoints: 8, estimatedSeconds: 86400, dueDate: '1403/04/15', createdAt: '1403/04/01', updatedAt: '1403/04/01', comments: 2, attachments: 1, subtasks: 2, completedSubtasks: 0 },
//   { id: 't15', key: 'APP-12', title: 'رفع باگ کرش در اندروید 12', description: 'رفع مشکل کرش اپلیکیشن در اندروید 12', type: 'bug', status: 'review', priority: 'highest', assignee: 'm4', reporter: 'm6', projectId: 'p2', sprintId: 's2', labels: ['Bug', 'Android'], storyPoints: 5, estimatedSeconds: 28800, dueDate: '1403/04/05', createdAt: '1403/03/31', updatedAt: '1403/04/02', comments: 9, attachments: 4, subtasks: 2, completedSubtasks: 2 },
// ];

// // Activities
// export const activities: Activity[] = [
//   { id: 'a1', userId: 'm2', action: 'task moved to In Progress', target: 'WEB-13', timestamp: '5 دقیقه پیش', type: 'task' },
//   { id: 'a2', userId: 'm3', action: 'uploaded attachment to', target: 'WEB-12', timestamp: '15 دقیقه پیش', type: 'file' },
//   { id: 'a3', userId: 'm1', action: 'created new sprint', target: 'اسپرینت 4', timestamp: '30 دقیقه پیش', type: 'sprint' },
//   { id: 'a4', userId: 'm6', action: 'commented on', target: 'APP-9', timestamp: '1 ساعت پیش', type: 'comment' },
//   { id: 'a5', userId: 'm4', action: 'completed task', target: 'WEB-12', timestamp: '2 ساعت پیش', type: 'task' },
//   { id: 'a6', userId: 'm5', action: 'pushed code for', target: 'APP-10', timestamp: '3 ساعت پیش', type: 'task' },
// ];

// // Stats
// export const dashboardStats = {
//   totalTasks: 156,
//   activeProjects: 4,
//   inProgressTasks: 42,
//   completedTasks: 89,
//   teamMembers: 8,
//   activeSprints: 2,
// };

// // Quick filters
// export const quickFilters = [
//   { id: 'mine', label: 'وظایف من', icon: 'user' },
//   { id: 'recent', label: 'اخیراً به‌روزرسانی', icon: 'clock' },
//   { id: 'high', label: 'اولویت بالا', icon: 'flag' },
//   { id: 'unassigned', label: 'بدون مسئول', icon: 'user-x' },
// ];

// // Priority config
// export const priorityConfig = {
//   highest: { label: 'بحرانی', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', icon: 'chevrons-up' },
//   high: { label: 'بالا', color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.15)', icon: 'chevron-up' },
//   medium: { label: 'متوسط', color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.15)', icon: 'minus' },
//   low: { label: 'پایین', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)', icon: 'chevron-down' },
//   lowest: { label: 'خیلی پایین', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', icon: 'chevrons-down' },
// };

// // Type config
// export const typeConfig = {
//   epic: { label: 'اپیک', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)', icon: 'layers' },
//   story: { label: 'استوری', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)', icon: 'book-open' },
//   task: { label: 'تسک', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', icon: 'check-square' },
//   bug: { label: 'باگ', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', icon: 'bug' },
//   subtask: { label: 'ساب‌تسک', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.15)', icon: 'git-branch' },
// };

// // Role permissions
// export const roles: Role[] = [
//   { id: 'admin', name: 'مدیر سامانه', description: 'دسترسی کامل به تمام بخش‌ها' },
//   { id: 'pm', name: 'مدیر پروژه', description: 'مدیریت پروژه، اسپرینت و تیم' },
//   { id: 'dev', name: 'توسعه‌دهنده', description: 'مشاهده و ویرایش وظایف محوله' },
//   { id: 'viewer', name: 'بیننده', description: 'فقط مشاهده بدون دسترسی ویرایش' },
// ];

// // Report types
// export const reportTypes = [
//   { id: 'burndown', name: 'نمودار Burndown', description: 'نمودار پیشرفت اسپرینت در طول زمان', icon: 'trending-down' },
//   { id: 'velocity', name: 'Velocity', description: 'سرعت تیم در اسپرینت‌های مختلف', icon: 'zap' },
//   { id: 'cumulative', name: 'Cumulative Flow', description: 'نمودار جریان تجمعی وظایف', icon: 'bar-chart-2' },
//   { id: 'epic', name: 'گزارش Epic', description: 'پیشرفت و وضعیت Epicها', icon: 'layers' },
//   { id: 'control', name: 'نمودار کنترل', description: 'نمودار کنترل چرخه زمانی وظایف', icon: 'activity' },
//   { id: 'created', name: 'ایجاد شده vs حل شده', description: 'مقایسه وظایف ایجاد و حل شده', icon: 'git-compare' },
// ];

// // Calendar events
// export const calendarEvents = [
//   { id: 'e1', title: 'جلسه روزانه اسکرام', date: '1403/04/03', time: '09:00', type: 'meeting', projectId: 'p1' },
//   { id: 'e2', title: 'ددلاین اسپرینت 4', date: '1403/04/15', time: '23:59', type: 'deadline', projectId: 'p1' },
//   { id: 'e3', title: 'جلسه بازبینی کد', date: '1403/04/05', time: '14:00', type: 'meeting', projectId: 'p2' },
//   { id: 'e4', title: 'ارائه به مشتری', date: '1403/04/10', time: '10:00', type: 'milestone', projectId: 'p1' },
// ];

// // Notifications
// export const notifications = [
//   { id: 'n1', title: 'وظیفه جدید محول شد', message: 'WEB-14 به شما محول شد', time: '2 دقیقه پیش', read: false, type: 'task' },
//   { id: 'n2', title: 'دیدگاه جدید', message: 'سارا روی APP-9 دیدگاه گذاشت', time: '15 دقیقه پیش', read: false, type: 'comment' },
//   { id: 'n3', title: 'اسپرینت به پایان نزدیک است', message: 'اسپرینت 4 در 3 روز آینده به پایان می‌رسد', time: '1 ساعت پیش', read: true, type: 'sprint' },
//   { id: 'n4', title: 'فایل جدید', message: 'رضا یک فایل جدید آپلود کرد', time: '2 ساعت پیش', read: true, type: 'file' },
// ];

// // Pricing plans
// export const pricingPlans: Plan[] = [
//   {
//     id: 'free',
//     name: 'رایگان',
//     description: 'برای شروع و تست',
//     priceMonthly: 0,
//     priceYearly: 0,
//     users: 1,
//     features: ['1 پروژه', '100 وظیفه', '500 مگابایت فضا', 'گزارش‌های پایه', 'پشتیبانی ایمیل'],
//     highlighted: false,
//     storage: '500 مگابایت فضا',
//     active: true,
//     order: 1,
//   },
//   {
//     id: 'team',
//     name: 'تیمی',
//     description: 'برای تیم‌های کوچک',
//     priceMonthly: 2000000,
//     priceYearly: 18000000,
//     users: 20,
//     features: ['پروژه نامحدود', 'وظیفه نامحدود', '10 گیگابایت فضا', 'گزارش‌های پیشرفته', 'کانبان و اسکرام', 'پشتیبانی 24/7'],
//     highlighted: true,
//     storage: '10 گیگابایت فضا',
//     active: true,
//     order: 2,
//   },
//   {
//     id: 'business',
//     name: 'کسب‌وکار',
//     description: 'برای سازمان‌های متوسط',
//     priceMonthly: 5000000,
//     priceYearly: 45000000,
//     users: 50,
//     features: ['همه امکانات تیمی', '100 گیگابایت فضا', 'API دسترسی', 'گزارش‌های سفارشی', 'مدیریت نقش‌ها', 'پشتیبانی اختصاصی'],
//     highlighted: false,
//     storage: '100 گیگابایت فضا',
//     active: true,
//     order: 3,
//   },
//   {
//     id: 'enterprise',
//     name: 'سازمانی',
//     description: 'برای سازمان‌های بزرگ',
//     priceMonthly: 0,
//     priceYearly: 0,
//     users: -1,
//     features: ['همه امکانات کسب‌وکار', 'فضای نامحدود', 'SSO و SAML', 'Audit Log', 'قرارداد SLA', 'مدیر اختصاصی'],
//     highlighted: false,
//     storage: 'فضای نامحدود',
//     active: true,
//     order: 4,
//   },
// ];

// // Files
// export const mockFiles = [
//   { id: 'f1', name: 'طراحی UI.pdf', type: 'pdf', size: '۲.۲ MB', date: '۱۴۰۳/۰۴/۰۱', time: '۱۳:۵۵', modifier: 'امیر حاجی‌زاده', avatar: 'amir' },
//   { id: 'f2', name: 'mockup-v2.fig', type: 'design', size: '۱.۰ MB', date: '۱۴۰۳/۰۴/۰۲', time: '۱۵:۱۰', modifier: 'نیلوفر صادقی', avatar: 'niloofar' },
//   { id: 'f3', name: 'api-docs.md', type: 'doc', size: '۱.۲ KB', date: '۱۴۰۳/۰۴/۰۳', time: '۱۱:۴۵', modifier: 'حسین رضایی', avatar: 'hossein' },
//   { id: 'f4', name: 'banner-home.jpg', type: 'image', size: '۱.۸ MB', date: '۱۴۰۳/۰۴/۰۵', time: '۰۹:۱۵', modifier: 'سارا محمدی', avatar: 'sara' },
//   { id: 'f5', name: 'requirements.pdf', type: 'pdf', size: '۵۶۰ KB', date: '۱۴۰۳/۰۴/۰۶', time: '۱۴:۲۰', modifier: 'رضا کریمی', avatar: 'reza' },
//   { id: 'f6', name: 'logo-final.png', type: 'image', size: '۴.۹ KB', date: '۱۴۰۳/۰۴/۰۷', time: '۱۰:۳۰', modifier: 'علی احمدی', avatar: 'ali' },
// ] as const;

// export const mockFolders = [
//   { name: 'طراحی', count: 4, date: '۱۴۰۳/۰۳/۲۸' },
//   { name: 'مستندات', count: 2, date: '۱۴۰۳/۰۴/۰۱' },
// ] as const;
