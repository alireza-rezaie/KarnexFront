import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X, Zap, Crown, Building2, Users, ChevronLeft, HelpCircle } from 'lucide-react'
import { usePlans } from '@/contexts/PlansContext'

export default function PricingPage() {
  const navigate = useNavigate()
  const { plans: pricingPlans } = usePlans()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')

  const allFeatures = [
    'پروژه نامحدود',
    'وظیفه نامحدود',
    'برد کانبان',
    'اسکرام و اسپرینت',
    'بک‌لاگ',
    'گزارش‌های پایه',
    'گزارش‌های پیشرفته',
    'API دسترسی',
    'مدیریت نقش‌ها',
    'فضای ذخیره‌سازی',
    'پشتیبانی ۲۴/۷',
    'SSO و SAML',
    'Audit Log',
    'قرارداد SLA',
  ]

  const getFeatureAvailability = (planId: string, feature: string) => {
    const availability: Record<string, Record<string, boolean | string>> = {
      free: {
        'پروژه نامحدود': false,
        'وظیفه نامحدود': false,
        'برد کانبان': true,
        'اسکرام و اسپرینت': true,
        'بک‌لاگ': true,
        'گزارش‌های پایه': true,
        'گزارش‌های پیشرفته': false,
        'API دسترسی': false,
        'مدیریت نقش‌ها': false,
        'فضای ذخیره‌سازی': '۵۰۰ MB',
        'پشتیبانی ۲۴/۷': false,
        'SSO و SAML': false,
        'Audit Log': false,
        'قرارداد SLA': false,
      },
      team: {
        'پروژه نامحدود': true,
        'وظیفه نامحدود': true,
        'برد کانبان': true,
        'اسکرام و اسپرینت': true,
        'بک‌لاگ': true,
        'گزارش‌های پایه': true,
        'گزارش‌های پیشرفته': true,
        'API دسترسی': false,
        'مدیریت نقش‌ها': true,
        'فضای ذخیره‌سازی': '۱۰ GB',
        'پشتیبانی ۲۴/۷': true,
        'SSO و SAML': false,
        'Audit Log': false,
        'قرارداد SLA': false,
      },
      business: {
        'پروژه نامحدود': true,
        'وظیفه نامحدود': true,
        'برد کانبان': true,
        'اسکرام و اسپرینت': true,
        'بک‌لاگ': true,
        'گزارش‌های پایه': true,
        'گزارش‌های پیشرفته': true,
        'API دسترسی': true,
        'مدیریت نقش‌ها': true,
        'فضای ذخیره‌سازی': '۱۰۰ GB',
        'پشتیبانی ۲۴/۷': true,
        'SSO و SAML': true,
        'Audit Log': true,
        'قرارداد SLA': false,
      },
      enterprise: {
        'پروژه نامحدود': true,
        'وظیفه نامحدود': true,
        'برد کانبان': true,
        'اسکرام و اسپرینت': true,
        'بک‌لاگ': true,
        'گزارش‌های پایه': true,
        'گزارش‌های پیشرفته': true,
        'API دسترسی': true,
        'مدیریت نقش‌ها': true,
        'فضای ذخیره‌سازی': 'نامحدود',
        'پشتیبانی ۲۴/۷': true,
        'SSO و SAML': true,
        'Audit Log': true,
        'قرارداد SLA': true,
      },
    }
    return availability[planId]?.[feature] ?? false
  }

  const formatPrice = (price: number) => {
    if (price === 0) return 'رایگان'
    return `${price.toLocaleString('fa-IR')} تومان`
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <button 
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ChevronLeft className="w-4 h-4" />
            بازگشت به صفحه اصلی
          </button>
          <h1 className="text-4xl font-bold text-foreground mb-4">قیمت‌گذاری ساده و شفاف</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            پلن مناسب تیم خود را انتخاب کنید. همیشه می‌توانید ارتقا دهید.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm ${billingCycle === 'monthly' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
            ماهانه
          </span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="relative w-14 h-7 rounded-full bg-secondary border border-border transition-colors"
          >
            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-primary transition-transform ${billingCycle === 'yearly' ? 'left-0.5' : 'right-0.5'}`} />
          </button>
          <span className={`text-sm ${billingCycle === 'yearly' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
            سالانه
          </span>
          {billingCycle === 'yearly' && (
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
              25٪ تخفیف
            </span>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {pricingPlans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border transition-all duration-300 ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-blue-500/10 to-purple-500/10 border-primary/50 scale-105 shadow-glow'
                  : 'bg-card border-border hover:border-border/80'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-medium">
                  پیشنهادی
                </div>
              )}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  {plan.id === 'free' && <Users className="w-5 h-5 text-muted-foreground" />}
                  {plan.id === 'team' && <Zap className="w-5 h-5 text-primary" />}
                  {plan.id === 'business' && <Building2 className="w-5 h-5 text-purple-400" />}
                  {plan.id === 'enterprise' && <Crown className="w-5 h-5 text-yellow-400" />}
                  <h3 className="font-bold text-lg text-foreground">{plan.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">
                      {plan.id === 'enterprise' ? 'تماس بگیرید' : formatPrice(billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly)}
                    </span>
                  </div>
                  {plan.id !== 'enterprise' && plan.id !== 'free' && (
                    <span className="text-xs text-muted-foreground">
                      {billingCycle === 'monthly' ? 'در ماه' : 'در سال'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mb-4">
                  {plan.users === -1 ? 'کاربر نامحدود' : `تا ${plan.users} کاربر`}
                </div>
                {plan.id === 'enterprise' ? (
                  <span className="block w-full py-2.5 rounded-xl text-center text-sm font-medium border border-border bg-secondary text-muted-foreground">
                    تماس با فروش
                  </span>
                ) : (
                  <button
                    onClick={() => navigate('/register')}
                    className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${
                      plan.highlighted
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-secondary text-foreground hover:bg-secondary/80 border border-border'
                    }`}
                  >
                    {plan.id === 'free' ? 'شروع رایگان' : 'انتخاب پلن'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Feature Comparison */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">مقایسه امکانات</h2>
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <div className="grid min-w-[680px] grid-cols-5 gap-4 border-b border-border bg-secondary/30 p-4 text-xs font-semibold">
              <div className="text-foreground">امکان</div>
              {pricingPlans.map(plan => (
                <div
                  key={plan.id}
                  className={`text-center ${plan.id === 'team' ? 'text-primary' : plan.id === 'business' ? 'text-purple-400' : plan.id === 'enterprise' ? 'text-yellow-400' : 'text-muted-foreground'}`}
                >
                  {plan.name}
                </div>
              ))}
            </div>
            {allFeatures.map((feature, index) => (
              <div 
                key={index} 
                className={`grid min-w-[680px] grid-cols-5 gap-4 p-4 text-xs ${index % 2 === 0 ? 'bg-secondary/10' : ''}`}
              >
                <div className="text-foreground">{feature}</div>
                {pricingPlans.map((plan) => {
                  const availability = getFeatureAvailability(plan.id, feature)
                  return (
                    <div key={plan.id} className="flex items-center justify-center">
                      {typeof availability === 'string' ? (
                        <span className="text-muted-foreground">{availability}</span>
                      ) : availability ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground/30" />
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">سوالات متداول</h2>
          <div className="max-w-2xl mx-auto space-y-4">
            {[
              { q: 'آیا می‌توانم پلن خود را تغییر دهم؟', a: 'بله، در هر زمان می‌توانید پلن خود را ارتقا یا کاهش دهید. تغییرات از دوره بعدی اعمال می‌شود.' },
              { q: 'آیا نسخه رایگان محدودیت زمانی دارد؟', a: 'خیر، نسخه رایگان برای همیشه رایگان است و محدودیت زمانی ندارد.' },
              { q: 'آیا امکان بازپرداخت وجود دارد؟', a: 'بله، تا ۱۴ روز پس از خرید امکان بازپرداخت کامل وجود دارد.' },
              { q: 'آیا داده‌های من امن هستند؟', a: 'بله، تمام داده‌ها با رمزنگاری AES-256 محافظت می‌شوند و در سرورهای داخلی ایران نگهداری می‌شوند.' },
            ].map((faq, index) => (
              <div key={index} className="p-4 rounded-xl bg-card border border-border">
                <h3 className="font-medium text-sm text-foreground mb-2">{faq.q}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-muted-foreground mb-4">هنوز سوال دارید؟</p>
          <span className="inline-flex items-center gap-2 px-6 py-3 border border-border rounded-xl text-muted-foreground">
            <HelpCircle className="w-4 h-4" />
            تماس با پشتیبانی
          </span>
        </div>
      </div>
    </div>
  )
}
