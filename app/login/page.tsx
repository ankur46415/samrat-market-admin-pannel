"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Lottie from "lottie-react"
import { Eye, EyeOff, Loader2, ShoppingCart, Apple, Egg, Milk, Utensils, Leaf } from "lucide-react"
import { loginWithFirebase, useSessionUser } from "@/lib/auth-session"

// ✅ Correct way to import JSON in Next.js client components
const manAnimation = require("@/assets/Man with task list.json")

export default function LoginPage() {
  const router = useRouter()
  const { user, ready } = useSessionUser()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  useEffect(() => {
    if (ready && user) router.replace("/")
  }, [ready, user, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await loginWithFirebase(email, password)
      router.replace("/")
    } catch (err: any) {
      setLoading(false)
      const msg =
        err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password"
          ? "Invalid email or password"
          : "Login failed. Please try again."
      setError(msg)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Poppins:wght@400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f4f3ff;
          font-family: 'Nunito', sans-serif;
          padding: 24px;
        }

        .login-card {
          background: #fff;
          border-radius: 24px;
          box-shadow: 0 8px 48px rgba(109, 40, 217, 0.10), 0 2px 12px rgba(0,0,0,0.06);
          display: flex;
          width: 100%;
          max-width: 900px;
          min-height: 540px;
          overflow: hidden;
        }

        /* ── LEFT PANEL ── */
        .login-left {
          flex: 1;
          background: #f0eeff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 32px;
          position: relative;
          overflow: hidden;
        }

        .login-left::before {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 50%;
          background: #ede9fe;
          border-radius: 50% 50% 0 0 / 30% 30% 0 0;
        }

        .lottie-wrap {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 300px;
        }

        /* ── RIGHT FORM PANEL ── */
        .login-right {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 52px 48px;
        }

        .brand-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 32px;
        }

        .brand-name {
          font-family: 'Poppins', sans-serif;
          font-weight: 700;
          font-size: 16px;
          color: #1e1b4b;
        }

        .form-title {
          font-family: 'Poppins', sans-serif;
          font-size: 28px;
          font-weight: 700;
          color: #7c3aed;
          margin-bottom: 4px;
        }

        .form-subtitle {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 32px;
          line-height: 1.5;
        }

        .field-group { margin-bottom: 20px; }

        .field-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #7c3aed;
          letter-spacing: 0.04em;
          margin-bottom: 6px;
        }

        .field-input {
          width: 100%;
          padding: 11px 14px;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          font-family: 'Nunito', sans-serif;
          font-size: 14px;
          color: #1e1b4b;
          outline: none;
          transition: border-color 0.18s, box-shadow 0.18s;
          background: #fff;
        }

        .field-input:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.10);
        }

        .field-input::placeholder { color: #9ca3af; }

        .password-wrap { position: relative; }
        .password-wrap .field-input { padding-right: 42px; }

        .eye-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #9ca3af;
          display: flex;
          align-items: center;
          padding: 0;
        }
        .eye-btn:hover { color: #7c3aed; }

        .bottom-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          margin-top: 4px;
        }

        .remember-label {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          color: #4b5563;
          cursor: pointer;
          user-select: none;
        }

        .remember-checkbox {
          width: 16px;
          height: 16px;
          accent-color: #7c3aed;
          cursor: pointer;
        }

        .forgot-link {
          font-size: 13px;
          color: #7c3aed;
          font-weight: 600;
          text-decoration: none;
          transition: color 0.15s;
        }
        .forgot-link:hover { color: #5b21b6; text-decoration: underline; }

        .error-box {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 9px 12px;
          font-size: 13px;
          color: #dc2626;
          margin-bottom: 16px;
        }

        .login-btn {
          width: 100%;
          padding: 13px;
          background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
          color: #fff;
          border: none;
          border-radius: 12px;
          font-family: 'Poppins', sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.18s, transform 0.18s, box-shadow 0.18s;
          box-shadow: 0 4px 18px rgba(124, 58, 237, 0.35);
          letter-spacing: 0.01em;
        }
        .login-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 6px 22px rgba(124, 58, 237, 0.42);
        }
        .login-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

        @media (max-width: 640px) {
          .login-left { display: none; }
          .login-right { padding: 36px 28px; }
          .login-card { max-width: 420px; }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .login-right { animation: fadeUp 0.45s ease both; }
        .login-left  { animation: fadeUp 0.45s 0.1s ease both; }

        @keyframes float1 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-20px) translateX(15px); }
          50% { transform: translateY(-40px) translateX(0px); }
          75% { transform: translateY(-20px) translateX(-15px); }
        }

        @keyframes float2 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-25px) translateX(-20px); }
          50% { transform: translateY(-45px) translateX(10px); }
          75% { transform: translateY(-20px) translateX(20px); }
        }

        @keyframes float3 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-30px) translateX(25px); }
          50% { transform: translateY(-50px) translateX(-5px); }
          75% { transform: translateY(-15px) translateX(-25px); }
        }

        @keyframes float4 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-20px) translateX(-15px); }
          50% { transform: translateY(-35px) translateX(20px); }
          75% { transform: translateY(-25px) translateX(0px); }
        }

        @keyframes float5 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-35px) translateX(10px); }
          50% { transform: translateY(-55px) translateX(-15px); }
          75% { transform: translateY(-10px) translateX(15px); }
        }

        @keyframes float6 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-25px) translateX(20px); }
          50% { transform: translateY(-40px) translateX(5px); }
          75% { transform: translateY(-20px) translateX(-20px); }
        }

        .floating-icon {
          position: absolute;
          opacity: 0.25;
          pointer-events: none;
          z-index: 0;
          stroke: #7c3aed !important;
          fill: none !important;
        }

        .floating-icon.icon1 { animation: float1 8s ease-in-out infinite; top: 10%; left: 15%; }
        .floating-icon.icon2 { animation: float2 10s ease-in-out infinite; top: 25%; right: 20%; animation-delay: 1s; }
        .floating-icon.icon3 { animation: float3 12s ease-in-out infinite; bottom: 15%; left: 15%; animation-delay: 2s; }
        .floating-icon.icon4 { animation: float4 9s ease-in-out infinite; top: 50%; left: 10%; animation-delay: 3s; }
        .floating-icon.icon5 { animation: float5 11s ease-in-out infinite; bottom: 25%; right: 15%; animation-delay: 1.5s; }
        .floating-icon.icon6 { animation: float6 10s ease-in-out infinite; top: 60%; right: 20%; animation-delay: 2.5s; }
      `}</style>

      <div className="login-root">
        <div className="login-card">

          {/* ── LEFT: Lottie Animation with Floating Icons ── */}
          <div className="login-left">
            {/* Floating Supermarket Icons */}
            <ShoppingCart size={64} className="floating-icon icon1" style={{ stroke: '#7c3aed', strokeWidth: 1.5 }} />
            <Apple size={64} className="floating-icon icon2" style={{ stroke: '#7c3aed', strokeWidth: 1.5 }} />
            <Egg size={64} className="floating-icon icon3" style={{ stroke: '#7c3aed', strokeWidth: 1.5 }} />
            <Milk size={64} className="floating-icon icon4" style={{ stroke: '#7c3aed', strokeWidth: 1.5 }} />
            <Utensils size={64} className="floating-icon icon5" style={{ stroke: '#7c3aed', strokeWidth: 1.5 }} />
            <Leaf size={64} className="floating-icon icon6" style={{ stroke: '#7c3aed', strokeWidth: 1.5 }} />

            <div className="lottie-wrap">
              <Lottie
                animationData={manAnimation}
                loop={true}
                autoplay={true}
                style={{ width: "100%", height: "auto" }}
              />
            </div>
          </div>

          {/* ── RIGHT: Form ── */}
          <div className="login-right">
            <div className="brand-row">
              <Image
                src="/images/samrat-market-logo.png"
                alt="Samrat Market"
                width={40}
                height={40}
                style={{ borderRadius: 10, objectFit: "cover" }}
                priority
              />
              <span className="brand-name">Samrat Market</span>
            </div>

            <h1 className="form-title">Log In</h1>
            <p className="form-subtitle">
              Log in with your data that you entered during<br />your registration.
            </p>

            <form onSubmit={handleLogin}>
              <div className="field-group">
                <label className="field-label">Username</label>
                <input
                  className="field-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="field-group">
                <label className="field-label">Password</label>
                <div className="password-wrap">
                  <input
                    className="field-input"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="bottom-row">
                <label className="remember-label">
                  <input
                    type="checkbox"
                    className="remember-checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  Keep me logged in
                </label>
                <a href="/forgot-password" className="forgot-link">Forgot Password?</a>
              </div>

              {error && <div className="error-box">{error}</div>}

              <button type="submit" className="login-btn" disabled={loading}>
                {loading && <Loader2 size={18} className="animate-spin" />}
                {loading ? "Signing in…" : "Login"}
              </button>
            </form>
          </div>

        </div>
      </div>
    </>
  )
}
