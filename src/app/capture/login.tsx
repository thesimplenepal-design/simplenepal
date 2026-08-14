import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

/**
 * Deliberately the simplest thing that works. There is exactly one operator
 * right now. Phone-OTP and real accounts arrive when claims launch — building
 * an auth system for a team of one is the classic way to spend three weeks
 * and verify zero restaurants.
 */
async function signIn(formData: FormData) {
  'use server'
  const pw = String(formData.get('password') ?? '')
  if (pw && pw === process.env.ADMIN_PASSWORD) {
    ;(await cookies()).set('sn_admin', 'ok', {
      httpOnly: true, sameSite: 'lax', path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
    })
    redirect('/capture')
  }
  redirect('/capture?e=1')
}

export function Login() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-[22px] font-bold tracking-tight">Field capture</h1>
      <p className="text-[14px] text-[--color-ink-2] mt-1.5 mb-6">
        For verifying places on the road.
      </p>
      <form action={signIn} className="space-y-3">
        <input
          name="password" type="password" autoFocus autoComplete="current-password"
          placeholder="Password" aria-label="Password"
          className="w-full h-12 px-3.5 rounded-xl border border-[--color-line]
                     bg-[--color-surface] text-[16px]"
        />
        <button className="w-full h-12 rounded-xl bg-[--color-crimson] text-white
                           font-medium text-[15px]">
          Sign in
        </button>
      </form>
    </div>
  )
}
