import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function AfterSignIn() {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && user) {
      const role = user.publicMetadata?.role;
      if (role === "recruiter") navigate("/recruiter-dashboard");
      else if (role === "candidate") navigate("/candidate-dashboard");
      else navigate("/select-role");
    }
  }, [isLoaded, user, navigate]);

  return <div>Loading...</div>;
} 