import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Building } from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">AutoHireAI</h1>
          <p className="text-gray-600">Intelligent Hiring Platform</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="space-y-4">
            <button
              onClick={() => navigate('/candidate')}
              className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <User className="w-5 h-5 mr-2" />
              Candidate Dashboard
            </button>
            
            <button
              onClick={() => navigate('/recruiter')}
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Building className="w-5 h-5 mr-2" />
              Recruiter Dashboard
            </button>
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Demo Mode - No authentication required
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage; 