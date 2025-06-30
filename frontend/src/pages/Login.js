import { SignIn } from "@clerk/clerk-react";

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <SignIn path="/login" routing="path" signUpUrl="/signup" afterSignInUrl="/after-sign-in" />
      </div>
    </div>
  );
} 