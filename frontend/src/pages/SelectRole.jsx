import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { User, Briefcase, Sparkles } from 'lucide-react';

export default function SelectRole() {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && user?.unsafeMetadata?.userRole) {
      if (user.unsafeMetadata.userRole === "recruiter") navigate("/recruiter-dashboard");
      else if (user.unsafeMetadata.userRole === "candidate") navigate("/candidate-dashboard");
    }
  }, [isLoaded, user, navigate]);

  const setRole = async (role) => {
    await user.update({ unsafeMetadata: { userRole: role } });
    if (role === "recruiter") navigate("/recruiter-dashboard");
    else if (role === "candidate") navigate("/candidate-dashboard");
  };

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans">
      {/* Animated gradient background */}
      <div className="absolute inset-0 z-0 animate-gradient bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 opacity-90" />
      {/* Animated sparkles or logo */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
        <Sparkles className="w-16 h-16 text-yellow-400 animate-pulse drop-shadow-lg" />
        <span className="text-2xl font-extrabold text-white tracking-widest mt-2 animate-fadeIn">AutoHireAI</span>
      </div>
      <div className="relative z-20 bg-white/30 backdrop-blur-2xl shadow-2xl rounded-3xl p-14 w-full max-w-xl flex flex-col items-center border-2 border-white/40 border-opacity-60 animate-fadeInCard" style={{boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)', borderRadius: '2rem'}}>
        <h2 className="text-5xl font-extrabold mb-2 text-gray-900 drop-shadow-lg text-center tracking-tight" style={{fontFamily: 'Poppins, sans-serif'}}>Choose Your Role</h2>
        <p className="text-lg text-gray-700 mb-10 text-center font-medium">Select how you want to use <span className="text-blue-700 font-bold">AutoHireAI</span></p>
        <div className="flex gap-10 w-full justify-center mb-6">
          <button
            className="flex flex-col items-center gap-3 bg-gradient-to-tr from-blue-700 via-blue-500 to-blue-400 hover:from-blue-800 hover:to-blue-600 text-white px-10 py-8 rounded-2xl shadow-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-blue-300 w-1/2 border-2 border-transparent hover:border-blue-300 animate-fadeInButton"
            onClick={() => setRole("recruiter")}
            style={{boxShadow: '0 4px 24px 0 rgba(0, 0, 0, 0.15)'}}
          >
            <Briefcase className="w-12 h-12 mb-2 text-white drop-shadow" />
            <span className="text-2xl font-bold">Recruiter</span>
            <span className="text-xs opacity-80">Post jobs, review candidates, and manage hiring</span>
          </button>
          <button
            className="flex flex-col items-center gap-3 bg-gradient-to-tr from-green-600 via-green-400 to-green-300 hover:from-green-700 hover:to-green-500 text-white px-10 py-8 rounded-2xl shadow-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-green-300 w-1/2 border-2 border-transparent hover:border-green-300 animate-fadeInButton"
            onClick={() => setRole("candidate")}
            style={{boxShadow: '0 4px 24px 0 rgba(0, 0, 0, 0.15)'}}
          >
            <User className="w-12 h-12 mb-2 text-white drop-shadow" />
            <span className="text-2xl font-bold">Candidate</span>
            <span className="text-xs opacity-80">Apply for jobs, upload your resume, and get matched</span>
          </button>
        </div>
        <div className="mt-6 text-center text-gray-700 text-sm opacity-90 font-medium animate-fadeIn">
          <span className="inline-block px-4 py-1 bg-white/40 rounded-full shadow border border-white/30">Empowering your hiring journey</span>
        </div>
      </div>
      {/* Fade-in animation keyframes */}
      <style>{`
        @keyframes fadeInCard { from { opacity: 0; transform: translateY(40px);} to { opacity: 1; transform: none; } }
        .animate-fadeInCard { animation: fadeInCard 1.2s cubic-bezier(.4,0,.2,1) both; }
        @keyframes fadeInButton { from { opacity: 0; transform: scale(0.95);} to { opacity: 1; transform: scale(1); } }
        .animate-fadeInButton { animation: fadeInButton 1.2s cubic-bezier(.4,0,.2,1) both; }
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradientMove 8s ease-in-out infinite;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 2s ease-in; }
      `}</style>
    </div>
  );
} 