import { SignUp } from "@clerk/clerk-react";
export default function Signup() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <SignUp path="/signup" routing="path" signInUrl="/login" afterSignUpUrl="/after-sign-in" />
      </div>
    </div>
  );
} 