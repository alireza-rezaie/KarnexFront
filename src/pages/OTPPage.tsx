import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ArrowLeft } from 'lucide-react'
import BrandLogo from '@/components/BrandLogo'
import { useAuth } from '@/contexts/AuthContext'

export default function OTPPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [submitError, setSubmitError] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const { serviceAvailable, loading, capabilities, verifyOtp, error, displayCopy } = useAuth()
  const verificationCode = code.join('')
  const codeValid = verificationCode.length === 6
  const canSubmit = serviceAvailable && capabilities.canVerifyOtp && !loading && Boolean(verifyOtp) && codeValid
  const unavailableMessage = !serviceAvailable ? displayCopy.serviceUnavailable : displayCopy.actionUnavailable

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return
    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newCode = [...code]
    pasted.split('').forEach((digit, i) => {
      if (i < 6) newCode[i] = digit
    })
    setCode(newCode)
    if (pasted.length < 6) {
      inputRefs.current[pasted.length]?.focus()
    }
  }

  const submitVerification = async () => {
    if (!canSubmit || !verifyOtp) return
    setSubmitError('')
    try {
      const result = await verifyOtp({ code: verificationCode })
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
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ChevronLeft className="w-4 h-4" />
          بازگشت به ورود
        </button>
        
        <div className="mb-8">
          <BrandLogo variant="mark" className="brand-logo--lg mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">تأیید کد</h1>
          <p className="text-sm text-muted-foreground">
            {serviceAvailable ? displayCopy.actionUnavailable : displayCopy.serviceUnavailable}
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-center gap-2" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 rounded-xl bg-secondary border border-border text-center text-xl font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                dir="ltr"
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={!canSubmit}
          title={loading ? displayCopy.loading : unavailableMessage}
          onClick={() => void submitVerification()}
          className="app-action mb-6 w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          تأیید و ادامه
          <ArrowLeft className="w-4 h-4" />
        </button>
        {submitError && <p className="mb-4 text-center text-xs text-destructive">{submitError}</p>}

        <div className="text-center space-y-4">
          <div className="text-sm text-muted-foreground">
            <span>{displayCopy.actionUnavailable}</span>
          </div>
          <div className="flex items-center justify-center">
            <button 
              onClick={() => navigate('/login')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              بازگشت به ورود
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
