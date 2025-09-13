import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
      <SignIn 
        appearance={{
          elements: {
            formButtonPrimary: 
              'bg-primary hover:bg-primary/90 text-sm normal-case',
          },
        }}
      />
    </div>
  )
}