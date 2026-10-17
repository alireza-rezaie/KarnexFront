import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ChevronLeft, ChevronRight, Check, User,
  FolderKanban, Layers, GitBranch, LayoutTemplate
} from 'lucide-react'
import BrandLogo from '@/components/BrandLogo'
import { usePlans } from '@/contexts/PlansContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'

interface OnboardingData {
  plan: string
  organization: {
    name: string
    displayName: string
    industry: string
    teamSize: string
    phone: string
    email: string
    website: string
  }
  admin: {
    firstName: string
    lastName: string
    jobTitle: string
    email: string
    phone: string
    role: string
  }
  projectType: string
  project: {
    name: string
    key: string
    description: string
    startDate: string
    endDate: string
    privacy: string
    color: string
  }
}

const steps = [
  { id: 'plan', label: 'پلن' },
  { id: 'org', label: 'سازمان' },
  { id: 'admin', label: 'مدیر' },
  { id: 'type', label: 'نوع' },
  { id: 'project', label: 'پروژه' },
]

const projectTypes = [
  { 
    id: 'scrum', 
    name: 'اسکرام', 
    description: 'برای تیم‌های چابک با اسپرینت‌های تکرارشونده',
    icon: Layers,
    workflow: ['برای انجام', 'در حال انجام', 'بازبینی', 'انجام شد'],
    gradient: 'from-blue-500/20 to-cyan-500/20',
    border: 'border-blue-500/30',
  },
  { 
    id: 'kanban', 
    name: 'کانبان', 
    description: 'برای تیم‌هایی با جریان مداوم کار',
    icon: GitBranch,
    workflow: ['دریافت‌شده', 'تحلیل', 'توسعه', 'تست', 'تحویل'],
    gradient: 'from-orange-500/20 to-yellow-500/20',
    border: 'border-orange-500/30',
  },
  { 
    id: 'basic', 
    name: 'پایه', 
    description: 'برای تیم‌های کوچک با ساختار ساده',
    icon: LayoutTemplate,
    workflow: ['برای انجام', 'در حال انجام', 'انجام شد'],
    gradient: 'from-purple-500/20 to-pink-500/20',
    border: 'border-purple-500/30',
  },
]

const colors = ['#3b82f6', '#f97316', '#22c55e', '#8b5cf6', '#ef4444', '#eab308']

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { plans } = usePlans()
  const { currentPlanId, changePlan } = useSubscription()
  const [currentStep, setCurrentStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({
    plan: currentPlanId ?? '',
    organization: { name: '', displayName: '', industry: '', teamSize: '', phone: '', email: '', website: '' },
    admin: { firstName: '', lastName: '', jobTitle: '', email: '', phone: '', role: 'owner' },
    projectType: 'scrum',
    project: { name: '', key: '', description: '', startDate: '', endDate: '', privacy: 'private', color: '#3b82f6' },
  })
  const onboardingPlans = plans
    .filter(plan => plan.id !== 'enterprise')
    .map(plan => ({
      ...plan,
      price: plan.priceMonthly === 0 ? '۰ تومان' : `${(plan.priceMonthly / 1_000_000).toLocaleString('fa-IR')} میلیون/ماه`,
      usersLabel: `${plan.users.toLocaleString('fa-IR')} کاربر`,
      features: plan.features.slice(0, 3),
    }))

  const updateField = (section: keyof OnboardingData, field: string, value: string) => {
    setData(prev => ({
      ...prev,
      [section]: {
        ...prev[section] as Record<string, string>,
        [field]: value,
      }
    }))
  }

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      const selectedPlan = plans.find((plan) => plan.id === data.plan)

      if (!selectedPlan || !selectedPlan.active) {
        toast.error('پلن انتخاب‌شده دیگر فعال نیست.')
        return
      }

      if (!changePlan) {
        toast.error('پلن انتخاب‌شده دیگر در دسترس نیست.')
        return
      }
      const result = await changePlan(data.plan)
      if (!result.ok) {
        toast.error(result.message ?? 'پلن انتخاب‌شده دیگر در دسترس نیست.')
        return
      }

      navigate('/dashboard')
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    } else {
      navigate('/otp')
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-border flex items-center px-6">
        <BrandLogo variant="full" />
        <div className="mr-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">راه‌اندازی</span>
          <span className="text-xs text-primary font-medium">
            {currentStep + 1} از {steps.length}
          </span>
        </div>
      </header>

      {/* Stepper */}
      <div className="py-6 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2" />
            <div 
              className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 transition-all duration-300"
              style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
            />
            {steps.map((step, index) => (
              <div 
                key={step.id}
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                  index <= currentStep 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary border border-border text-muted-foreground'
                }`}
              >
                {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            {steps.map((step, index) => (
              <span 
                key={step.id}
                className={`text-[10px] ${index <= currentStep ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {step.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* Step 1: Plan Selection */}
          {currentStep === 0 && (
            <div className="animate-fadeIn">
              <h2 className="text-xl font-bold text-foreground mb-2">انتخاب پلن</h2>
              <p className="text-sm text-muted-foreground mb-6">پلن مناسب سازمان خود را انتخاب کنید</p>
              <div className="space-y-3">
                {onboardingPlans.map((plan) => (
                  <button
                    key={plan.id}
                    disabled={!plan.active}
                    onClick={() => {
                      if (plan.active) {
                        setData({ ...data, plan: plan.id })
                      }
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border text-right transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                      data.plan === plan.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border bg-card hover:border-border/80'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      data.plan === plan.id ? 'border-primary' : 'border-muted-foreground/30'
                    }`}>
                      {data.plan === plan.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm text-foreground">{plan.name}</h3>
                        <span className="text-xs text-primary font-medium">{plan.price}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{plan.usersLabel}</p>
                      <div className="flex gap-2 mt-2">
                        {plan.features.map((f, i) => (
                          <span key={i} className="text-[10px] bg-secondary px-2 py-0.5 rounded text-muted-foreground">{f}</span>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Organization */}
          {currentStep === 1 && (
            <div className="animate-fadeIn">
              <h2 className="text-xl font-bold text-foreground mb-2">اطلاعات سازمان</h2>
              <p className="text-sm text-muted-foreground mb-6">اطلاعات سازمان خود را وارد کنید</p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">نام سازمان</label>
                    <input
                      type="text"
                      value={data.organization.name}
                      onChange={(e) => updateField('organization', 'name', e.target.value)}
                      placeholder="شرکت نمونه"
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">نام نمایشی</label>
                    <input
                      type="text"
                      value={data.organization.displayName}
                      onChange={(e) => updateField('organization', 'displayName', e.target.value)}
                      placeholder="نمونه‌کو"
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">حوزه فعالیت</label>
                    <select
                      value={data.organization.industry}
                      onChange={(e) => updateField('organization', 'industry', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    >
                      <option value="">انتخاب کنید</option>
                      <option value="tech">فناوری اطلاعات</option>
                      <option value="finance">مالی و بانکی</option>
                      <option value="retail">خرده‌فروشی</option>
                      <option value="education">آموزش</option>
                      <option value="health">سلامت</option>
                      <option value="other">سایر</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">اندازه تیم</label>
                    <select
                      value={data.organization.teamSize}
                      onChange={(e) => updateField('organization', 'teamSize', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    >
                      <option value="">انتخاب کنید</option>
                      <option value="1-10">1 تا 10 نفر</option>
                      <option value="11-50">11 تا 50 نفر</option>
                      <option value="51-200">51 تا 200 نفر</option>
                      <option value="200+">بیش از 200 نفر</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">شماره تماس</label>
                  <input
                    type="tel"
                    value={data.organization.phone}
                    onChange={(e) => updateField('organization', 'phone', e.target.value)}
                    placeholder="۰۲۱-۱۲۳۴۵۶۷۸"
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">ایمیل سازمان</label>
                  <input
                    type="email"
                    value={data.organization.email}
                    onChange={(e) => updateField('organization', 'email', e.target.value)}
                    placeholder="info@company.ir"
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">وب‌سایت</label>
                  <input
                    type="url"
                    value={data.organization.website}
                    onChange={(e) => updateField('organization', 'website', e.target.value)}
                    placeholder="https://company.ir"
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Admin */}
          {currentStep === 2 && (
            <div className="animate-fadeIn">
              <h2 className="text-xl font-bold text-foreground mb-2">مدیر سامانه</h2>
              <p className="text-sm text-muted-foreground mb-6">اطلاعات مدیر سامانه را وارد کنید</p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">نام</label>
                    <input
                      type="text"
                      value={data.admin.firstName}
                      onChange={(e) => updateField('admin', 'firstName', e.target.value)}
                      placeholder="علی"
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">نام خانوادگی</label>
                    <input
                      type="text"
                      value={data.admin.lastName}
                      onChange={(e) => updateField('admin', 'lastName', e.target.value)}
                      placeholder="احمدی"
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">عنوان شغلی</label>
                  <input
                    type="text"
                    value={data.admin.jobTitle}
                    onChange={(e) => updateField('admin', 'jobTitle', e.target.value)}
                    placeholder="مدیر فنی"
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">ایمیل</label>
                  <input
                    type="email"
                    value={data.admin.email}
                    onChange={(e) => updateField('admin', 'email', e.target.value)}
                    placeholder="ali@company.ir"
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">موبایل</label>
                  <input
                    type="tel"
                    value={data.admin.phone}
                    onChange={(e) => updateField('admin', 'phone', e.target.value)}
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">نقش</label>
                  <div className="flex gap-3">
                    {[
                      { id: 'owner', label: 'مالک سازمان' },
                      { id: 'admin', label: 'مدیر سیستم' },
                    ].map((role) => (
                      <button
                        key={role.id}
                        onClick={() => updateField('admin', 'role', role.id)}
                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                          data.admin.role === role.id 
                            ? 'border-primary bg-primary/5 text-primary' 
                            : 'border-border bg-card text-muted-foreground hover:border-border/80'
                        }`}
                      >
                        <User className="w-4 h-4" />
                        <span className="text-sm">{role.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Project Type */}
          {currentStep === 3 && (
            <div className="animate-fadeIn">
              <h2 className="text-xl font-bold text-foreground mb-2">نوع پروژه</h2>
              <p className="text-sm text-muted-foreground mb-6">متدولوژی مدیریت پروژه را انتخاب کنید</p>
              <div className="space-y-4">
                {projectTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setData({ ...data, projectType: type.id })}
                    className={`w-full p-5 rounded-xl border transition-all text-right ${
                      data.projectType === type.id 
                        ? `bg-gradient-to-br ${type.gradient} ${type.border}` 
                        : 'border-border bg-card hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        data.projectType === type.id ? 'bg-primary/20' : 'bg-secondary'
                      }`}>
                        <type.icon className={`w-5 h-5 ${
                          data.projectType === type.id ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-foreground">{type.name}</h3>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            data.projectType === type.id ? 'border-primary' : 'border-muted-foreground/30'
                          }`}>
                            {data.projectType === type.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{type.description}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {type.workflow.map((step, i) => (
                            <span key={i} className="text-[10px] bg-secondary/80 px-2 py-0.5 rounded text-muted-foreground">
                              {step}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Project Info */}
          {currentStep === 4 && (
            <div className="animate-fadeIn">
              <h2 className="text-xl font-bold text-foreground mb-2">اطلاعات پروژه</h2>
              <p className="text-sm text-muted-foreground mb-6">پروژه اول خود را بسازید</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">نام پروژه</label>
                  <input
                    type="text"
                    value={data.project.name}
                    onChange={(e) => updateField('project', 'name', e.target.value)}
                    placeholder="پروژه نمونه"
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">کلید پروژه</label>
                  <input
                    type="text"
                    value={data.project.key}
                    onChange={(e) => updateField('project', 'key', e.target.value.toUpperCase())}
                    placeholder="PRJ"
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    dir="ltr"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">توضیحات</label>
                  <textarea
                    value={data.project.description}
                    onChange={(e) => updateField('project', 'description', e.target.value)}
                    placeholder="توضیحات پروژه..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">تاریخ شروع</label>
                    <input
                      type="text"
                      value={data.project.startDate}
                      onChange={(e) => updateField('project', 'startDate', e.target.value)}
                      placeholder="۱۴۰۳/۰۱/۰۱"
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">تاریخ پایان</label>
                    <input
                      type="text"
                      value={data.project.endDate}
                      onChange={(e) => updateField('project', 'endDate', e.target.value)}
                      placeholder="۱۴۰۳/۱۲/۲۹"
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">رنگ پروژه</label>
                  <div className="flex gap-3">
                    {colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => updateField('project', 'color', color)}
                        className={`w-8 h-8 rounded-full transition-all ${
                          data.project.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-background scale-110' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">حریم خصوصی</label>
                  <div className="flex gap-3">
                    {[
                      { id: 'private', label: 'خصوصی' },
                      { id: 'public', label: 'عمومی' },
                    ].map((privacy) => (
                      <button
                        key={privacy.id}
                        onClick={() => updateField('project', 'privacy', privacy.id)}
                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                          data.project.privacy === privacy.id 
                            ? 'border-primary bg-primary/5 text-primary' 
                            : 'border-border bg-card text-muted-foreground hover:border-border/80'
                        }`}
                      >
                        <span className="text-sm">{privacy.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="border-t border-border p-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all text-sm"
          >
            <ChevronRight className="w-4 h-4" />
            قبلی
          </button>
          <button
        onClick={() => void handleNext()}
            className="app-action px-6"
          >
            {currentStep === steps.length - 1 ? 'ساخت پروژه' : 'ادامه'}
            {currentStep === steps.length - 1 ? <FolderKanban className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <Toaster />
    </div>
  )
}
