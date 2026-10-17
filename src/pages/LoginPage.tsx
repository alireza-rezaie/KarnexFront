import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft, ChevronLeft } from 'lucide-react'
import BrandLogo from '@/components/BrandLogo'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', remember: false })
  const [submitError, setSubmitError] = useState('')
  const { serviceAvailable, loading, capabilities, login, error, displayCopy } = useAuth()
  const formValid = Boolean(form.username.trim() && form.password)
  const canSubmit = serviceAvailable && capabilities.canLogin && !loading && Boolean(login) && formValid
  const unavailableMessage = !serviceAvailable ? displayCopy.serviceUnavailable : displayCopy.actionUnavailable

  const submitLogin = async () => {
    if (!canSubmit || !login) return
    setSubmitError('')
    try {
      const result = await login(form)
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
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Form Side */}
        <div className="order-2 lg:order-1">
          <button 
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ChevronLeft className="w-4 h-4" />
            بازگشت به صفحه اصلی
          </button>
          
          <div className="mb-8">
            <BrandLogo variant="mark" className="brand-logo--lg mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">ورود به کارنکس</h1>
            <p className="text-sm text-muted-foreground">
              به سامانه مدیریت پروژه کارنکس خوش آمدید
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                نام کاربری یا ایمیل
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="09123456789"
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                رمز عبور
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm pl-12"
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
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.remember}
                  onChange={(e) => setForm({ ...form, remember: e.target.checked })}
                  className="w-4 h-4 rounded border-border bg-secondary text-primary focus:ring-primary"
                />
                <span className="text-sm text-muted-foreground">مرا به خاطر بسپار</span>
              </label>
            </div>

            <button
              type="button"
              disabled={!canSubmit}
              title={loading ? displayCopy.loading : unavailableMessage}
              onClick={() => void submitLogin()}
              className="app-action w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              ورود
              <ArrowLeft className="w-4 h-4" />
            </button>
            {!serviceAvailable && <p className="text-center text-xs text-muted-foreground">{displayCopy.serviceUnavailable}</p>}
            {submitError && <p className="text-center text-xs text-destructive">{submitError}</p>}
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              حساب کاربری ندارید؟{' '}
              <button 
                onClick={() => navigate('/register')}
                className="text-primary hover:underline font-medium"
              >
                ثبت‌نام کنید
              </button>
            </p>
          </div>
        </div>

        {/* Preview Side */}
        <div className="order-1 lg:order-2 hidden lg:block">
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-3xl blur-xl" />
            <div className="relative bg-card border border-border rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <BrandLogo variant="mark" />
                <div>
                  <h3 className="font-bold text-foreground">کارنکس</h3>
                  <p className="text-xs text-muted-foreground">مدیریت پروژه هوشمند</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-16 rounded-xl bg-secondary/60 border border-border p-3">
                    <div className="w-6 h-6 rounded bg-blue-500/20 mb-1" />
                    <div className="h-2 rounded bg-secondary w-3/4" />
                  </div>
                  <div className="h-16 rounded-xl bg-secondary/60 border border-border p-3">
                    <div className="w-6 h-6 rounded bg-orange-500/20 mb-1" />
                    <div className="h-2 rounded bg-secondary w-3/4" />
                  </div>
                  <div className="h-16 rounded-xl bg-secondary/60 border border-border p-3">
                    <div className="w-6 h-6 rounded bg-green-500/20 mb-1" />
                    <div className="h-2 rounded bg-secondary w-3/4" />
                  </div>
                </div>
                <div className="h-32 rounded-xl bg-secondary/40 border border-border p-4">
                  <div className="h-3 rounded bg-secondary w-1/3 mb-3" />
                  <div className="flex items-end gap-2 h-20">
                    {[50, 70, 40, 85, 60, 75, 65].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t bg-primary/20" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 h-20 rounded-xl bg-secondary/40 border border-border p-3">
                    <div className="h-2 rounded bg-secondary w-2/3 mb-2" />
                    <div className="h-2 rounded bg-secondary w-full mb-1" />
                    <div className="h-2 rounded bg-secondary w-5/6" />
                  </div>
                  <div className="flex-1 h-20 rounded-xl bg-secondary/40 border border-border p-3">
                    <div className="h-2 rounded bg-secondary w-2/3 mb-2" />
                    <div className="h-2 rounded bg-secondary w-full mb-1" />
                    <div className="h-2 rounded bg-secondary w-4/5" />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-muted-foreground">هزاران تیم به کارنکس اعتماد کرده‌اند</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
