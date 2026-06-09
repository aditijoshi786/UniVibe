import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, Eye, EyeOff, Plus, X, Check, Loader } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { UserRole } from '../types'
import toast from 'react-hot-toast'

const roles: { value: UserRole; label: string; desc: string; needsCode: boolean }[] = [
  { value: 'viewer',       label: 'Viewer',       desc: 'Browse public events',            needsCode: false },
  { value: 'club_member',  label: 'Club Member',  desc: 'Access your club content',        needsCode: true  },
  { value: 'photographer', label: 'Photographer', desc: 'Upload and manage media',          needsCode: true  },
  { value: 'admin',        label: 'Admin',        desc: 'Platform admin (one-time setup)', needsCode: true  },
]

type CodeEntry = {
  value: string
  status: 'idle' | 'checking' | 'valid' | 'invalid'
  message?: string
  codeId?: string
  clubId?: string
  clubName?: string
}

async function checkCode(role: UserRole, code: string): Promise<{ valid: boolean; error?: string; id?: string; clubId?: string; clubName?: string }> {
  if (!code.trim()) return { valid: false, error: 'Enter a code' }

  const { data, error } = await supabase
    .from('role_codes')
    .select('*, clubs(name)')
    .eq('role', role)
    .eq('code', code.trim().toUpperCase())
    .single()

  if (error || !data) return { valid: false, error: 'Invalid code' }
  if (!data.is_active) return { valid: false, error: 'Code is deactivated' }
  if (data.expires_at && new Date(data.expires_at) < new Date()) return { valid: false, error: 'Code has expired' }
  if (data.max_uses !== null && data.use_count >= data.max_uses) return { valid: false, error: 'Code already used up' }

  const clubName = data.clubs?.name ?? null
  return { valid: true, id: data.id, clubId: data.club_id, clubName }
}

export default function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState<UserRole>('viewer')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)

  // single code for admin/photographer
  const [singleCode, setSingleCode] = useState('')

  // multiple codes for club_member
  const [clubCodes, setClubCodes] = useState<CodeEntry[]>([{ value: '', status: 'idle' }])

  const selectedRole = roles.find(r => r.value === role)!

  function addCodeField() {
    setClubCodes(prev => [...prev, { value: '', status: 'idle' }])
  }

  function removeCodeField(i: number) {
    setClubCodes(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateCodeValue(i: number, val: string) {
    setClubCodes(prev => prev.map((c, idx) => idx === i ? { value: val.toUpperCase(), status: 'idle' } : c))
  }

  async function validateCode(i: number) {
    const entry = clubCodes[i]
    if (!entry.value.trim()) return

    setClubCodes(prev => prev.map((c, idx) => idx === i ? { ...c, status: 'checking' } : c))
    const result = await checkCode('club_member', entry.value)
    setClubCodes(prev => prev.map((c, idx) => idx === i ? {
      ...c,
      status: result.valid ? 'valid' : 'invalid',
      message: result.valid ? (result.clubName ? `✓ ${result.clubName}` : '✓ Valid') : result.error,
      codeId: result.id,
      clubId: result.clubId,
      clubName: result.clubName,
    } : c))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    try {
      setLoading(true)

      // Validate codes based on role
      if (role === 'club_member') {
        const filled = clubCodes.filter(c => c.value.trim())
        if (filled.length === 0) {
          toast.error('Enter at least one club code')
          setLoading(false)
          return
        }

        // Validate any unvalidated codes
        const validated = await Promise.all(
          filled.map(async (c) => {
            if (c.status === 'valid') return c
            const result = await checkCode('club_member', c.value)
            return {
              ...c,
              status: result.valid ? 'valid' as const : 'invalid' as const,
              message: result.valid ? (result.clubName ? `✓ ${result.clubName}` : '✓ Valid') : result.error,
              codeId: result.id,
              clubId: result.clubId,
              clubName: result.clubName,
            }
          })
        )

        const invalid = validated.find(c => c.status === 'invalid')
        if (invalid) {
          toast.error(`Code "${invalid.value}": ${invalid.message}`)
          setLoading(false)
          return
        }

        // Signup
        const { data, error } = await signUp(email, password, fullName, role)
        if (error) { toast.error(error.message); setLoading(false); return }

        // Create profile first, then memberships
        if (data.user) {
          // Ensure profile exists before inserting memberships
          await supabase.from('profiles').upsert({
            id:         data.user.id,
            email:      email,
            full_name:  fullName,
            role:       'club_member',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' })

          // Now create memberships
          for (const c of validated) {
            if (c.clubId) {
              await supabase.from('club_memberships').insert({
                user_id: data.user.id,
                club_id: c.clubId,
              })
            }
            if (c.codeId) {
              try { await supabase.rpc('increment_code_use', { code_id: c.codeId }) } catch { /* non-critical */ }
            }
          }
        }

        const clubNames = validated.filter(c => c.clubName).map(c => c.clubName).join(', ')
        toast.success(`Account created! Joined: ${clubNames || 'club(s)'}`)
        navigate('/login')
        return
      }

      // Admin / Photographer single code
      if (selectedRole.needsCode) {
        if (!singleCode.trim()) {
          toast.error(`Enter the ${selectedRole.label} access code`)
          setLoading(false)
          return
        }
        const result = await checkCode(role, singleCode)
        if (!result.valid) {
          toast.error(result.error ?? 'Invalid code')
          setLoading(false)
          return
        }
        if (result.id) {
          try { await supabase.rpc('increment_code_use', { code_id: result.id }) } catch { /* non-critical */ }
        }
      }

      const { data: signupData, error } = await signUp(email, password, fullName, role)
      if (error) {
        toast.error(error.message)
      } else {
        // Create profile immediately for admin/photographer/viewer
        if (signupData?.user) {
          await supabase.from('profiles').upsert({
            id:         signupData.user.id,
            email:      email,
            full_name:  fullName,
            role:       role,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' })
        }
        toast.success('Account created! You can now sign in.')
        navigate('/login')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-college-navy mb-4">
            <Camera size={28} className="text-college-gold" />
          </div>
          <h1 className="text-2xl font-display font-bold text-college-navy">Create your account</h1>
          <p className="text-gray-500 text-sm mt-1">Join your club on UniVibe</p>
        </div>

        <div className="card shadow-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input type="text" className="input" placeholder="Aditi Joshi"
                value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>

            <div>
              <label className="label">Email address</label>
              <input type="email" className="input" placeholder="you@college.edu"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input pr-10"
                  placeholder="Min. 6 characters" value={password}
                  onChange={e => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Role picker */}
            <div>
              <label className="label">I am a...</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {roles.map(r => (
                  <button key={r.value} type="button"
                    onClick={() => { setRole(r.value); setSingleCode(''); setClubCodes([{ value: '', status: 'idle' }]) }}
                    className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                      role === r.value ? 'border-college-amber bg-amber-50' : 'border-gray-200 hover:border-amber-200 text-gray-600'
                    }`}>
                    <p className="font-semibold">{r.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{r.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Club member — multiple codes */}
            {role === 'club_member' && (
              <div>
                <label className="label">Club Access Codes</label>
                <p className="text-xs text-gray-400 mb-2">Enter one code per club you belong to.</p>
                <div className="space-y-2">
                  {clubCodes.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          className={`input uppercase tracking-widest font-mono pr-9 text-sm ${
                            entry.status === 'valid'   ? 'border-green-400 bg-green-50' :
                            entry.status === 'invalid' ? 'border-red-400 bg-red-50' : ''
                          }`}
                          placeholder="e.g. MEM-NSCC-A3KX7P"
                          value={entry.value}
                          onChange={e => updateCodeValue(i, e.target.value)}
                          onBlur={() => validateCode(i)}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2">
                          {entry.status === 'checking' && <Loader size={14} className="text-gray-400 animate-spin" />}
                          {entry.status === 'valid'    && <Check size={14} className="text-green-500" />}
                          {entry.status === 'invalid'  && <X size={14} className="text-red-500" />}
                        </span>
                      </div>
                      {clubCodes.length > 1 && (
                        <button type="button" onClick={() => removeCodeField(i)}
                          className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                  {/* Club name hints */}
                  {clubCodes.some(c => c.status === 'valid' && c.clubName) && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {clubCodes.filter(c => c.status === 'valid' && c.clubName).map((c, i) => (
                        <span key={i} className="badge-amber text-xs">{c.clubName}</span>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={addCodeField}
                    className="flex items-center gap-1.5 text-college-amber text-sm font-medium hover:underline mt-1">
                    <Plus size={14} /> Add another club code
                  </button>
                </div>
              </div>
            )}

            {/* Admin / Photographer — single code */}
            {selectedRole.needsCode && role !== 'club_member' && (
              <div>
                <label className="label">{selectedRole.label} Access Code</label>
                <input type="text" className="input uppercase tracking-widest font-mono"
                  placeholder={`Enter ${selectedRole.label} code`}
                  value={singleCode} onChange={e => setSingleCode(e.target.value.toUpperCase())} />
                <p className="text-xs text-gray-400 mt-1">Get this code from your platform admin.</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-college-amber font-semibold hover:underline">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
