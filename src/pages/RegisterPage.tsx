import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft, ChevronLeft, Check, X } from 'lucide-react'
import BrandLogo from '@/components/BrandLogo'
import { useAuth } from '@/contexts/AuthContext'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [submitError, setSubmitError] = useState('')
  const { serviceAvailable, loading, capabilities, register, error, displayCopy } = useAuth()

  const getPasswordStrength = (password: string) => {
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return score
  }

  const strength = getPasswordStrength(form.password)
  const strengthLabels = ['خیلی ضعیف', 'ضعیف', 'متوسط', 'قوی', 'خیلی قوی']
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-green-400']

  const validations = [
    { label: 'حداقل ۸ کاراکتر', valid: form.password.length >= 8 },
    { label: 'حداقل یک حرف بزرگ', valid: /[A-Z]/.test(form.password) },
    { label: 'حداقل یک عدد', valid: /[0-9]/.test(form.password) },
    { label: 'حداقل یک کاراکتر خاص', valid: /[^A-Za-z0-9]/.test(form.password) },
  ]
  const formValid = Boolean(
    form.firstName.trim()
    && form.lastName.trim()
    && form.username.trim()
    && form.phone.trim()
    && form.email.trim()
    && form.password
    && form.confirmPassword
    && form.password === form.confirmPassword
    && validations.every((validation) => validation.valid),
  )
  const canSubmit = serviceAvailable && capabilities.canRegister && !loading && Boolean(register) && formValid
  const unavailableMessage = !serviceAvailable ? displayCopy.serviceUnavailable : displayCopy.actionUnavailable

  const submitRegistration = async () => {
    if (!canSubmit || !register) return
    setSubmitError('')
    try {
      const result = await register({
        firstName: form.firstName,
        lastName: form.lastName,
        username: form.username,
        phone: form.phone,
        email: form.email,
        password: form.password,
      })
      if (result.ok) {
        if (result.nextPath) navigate(result.nextPath)
        return
      }
      setSubmitError(result.message ?? error ?? displayCopy.actionUnavailable)
    } catch {
      setSubmitError(error ?? displayCopy.actionUnavailable)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button 
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ChevronLeft className="w-4 h-4" />
          بازگشت به صفحه اصلی
        </button>
        
        <div className="mb-8">
          <BrandLogo variant="mark" className="brand-logo--lg mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">ثبت‌نام در کارنکس</h1>
          <p className="text-sm text-muted-foreground">
            حساب کاربری جدید بسازید و شروع کنید
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">نام</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="علی"
                className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">نام خانوادگی</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="احمدی"
                className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">نام کاربری</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="ali_ahmadi"
              className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">شماره موبایل</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="۰۹۱۲۳۴۵۶۷۸۹"
              className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">ایمیل</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="ali@company.ir"
              className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">رمز عبور</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm pl-12"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i < strength ? strengthColors[strength - 1] : 'bg-secondary'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  قدرت رمز: {strengthLabels[strength - 1] || 'خیلی ضعیف'}
                </p>
              </div>
            )}
            {form.password && (
              <div className="mt-2 space-y-1">
                {validations.map((v, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    {v.valid ? (
                      <Check className="w-3 h-3 text-green-400" />
                    ) : (
                      <X className="w-3 h-3 text-muted-foreground/30" />
                    )}
                    <span className={`text-[10px] ${v.valid ? 'text-green-400' : 'text-muted-foreground'}`}>
                      {v.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">تکرار رمز عبور</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm pl-12"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.confirmPassword && form.password !== form.confirmPassword && (
              <p className="text-[10px] text-red-400 mt-1">رمز عبور و تکرار آن یکسان نیستند</p>
            )}
          </div>

          <button
            type="button"
            disabled={!canSubmit}
            title={loading ? displayCopy.loading : unavailableMessage}
            onClick={() => void submitRegistration()}
            className="app-action mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            ثبت‌نام
            <ArrowLeft className="w-4 h-4" />
          </button>
          {!serviceAvailable && <p className="text-center text-xs text-muted-foreground">{displayCopy.serviceUnavailable}</p>}
          {submitError && <p className="text-center text-xs text-destructive">{submitError}</p>}
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            قبلاً حساب دارید؟{' '}
            <button 
              onClick={() => navigate('/login')}
              className="text-primary hover:underline font-medium"
            >
              وارد شوید
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
