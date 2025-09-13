import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
      <SignUp 
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