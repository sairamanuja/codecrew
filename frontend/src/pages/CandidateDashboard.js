import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Upload, FileText, Phone, Mail, CheckCircle, Clock, AlertCircle, Mic, LogOut } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Radar, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
} from 'chart.js';
import { resumeAPI, interviewAPI, candidateAPI, jobAPI } from '../services/api';
import confetti from 'canvas-confetti';
import { SignOutButton, useUser } from "@clerk/clerk-react";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement
);

function injectOmnidimensionWidget() {
  if (!document.getElementById('omnidimension-web-widget')) {
    const script = document.createElement('script');
    script.id = 'omnidimension-web-widget';
    script.async = true;
    script.src = 'https://backend.omnidim.io/web_widget.js?secret_key=3d26cf24b4f427e5d8930fcfa17ca37e';
    document.body.appendChild(script);
  }
}

function removeOmnidimensionWidget() {
  const script = document.getElementById('omnidimension-web-widget');
  if (script) script.remove();
}

const CandidateDashboard = () => {
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [jobSkills, setJobSkills] = useState('python,react,aws,docker,git');
  const [jobDescription, setJobDescription] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeData, setResumeData] = useState(null);
  const [atsAnalysis, setAtsAnalysis] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [interviewAnalysis, setInterviewAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const widgetRef = useRef(null);
  const [jobSearch, setJobSearch] = useState("");
  const [jobSort, setJobSort] = useState("title");
  const [jobModal, setJobModal] = useState(null);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [widgetLoading, setWidgetLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [lastStatus, setLastStatus] = useState(null);
  const { user } = useUser();

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (interviewStarted) {
      // Remove any existing script
      const existing = document.getElementById('omnidimension-web-widget-script');
      if (existing) existing.remove();
      // Inject the script into the body
      const script = document.createElement('script');
      script.id = 'omnidimension-web-widget-script';
      script.async = true;
      script.src = 'https://backend.omnidim.io/web_widget.js?secret_key=3d26cf24b4f427e5d8930fcfa17ca37e';
      document.body.appendChild(script);
    }
  }, [interviewStarted]);

  useEffect(() => {
    let interval;
    if (interviewStarted && candidate && candidate.status !== 'interview_completed') {
      setPolling(true);
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/candidates`);
          const data = await res.json();
          if (data && data.candidates) {
            const updated = data.candidates.find(c => c.email === candidate.email);
            if (updated) {
              if (updated.status !== lastStatus) {
                setLastStatus(updated.status);
                if (updated.status === 'interview_completed') {
                  toast.success('Interview completed! Results are being evaluated.');
                  confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                } else if (updated.status === 'evaluated') {
                  toast.success('Your results are ready!');
                  confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
                } else if (updated.status === 'interview_started') {
                  toast('Interview started!', { icon: '🎤' });
                }
              }
              setCandidate(updated);
              if (updated.status === 'interview_completed') {
                setInterviewStarted(false);
                setPolling(false);
                clearInterval(interval);
                // When interview is completed or cancelled, remove the widget script from the DOM:
                const widgetScript = document.getElementById('omnidimension-web-widget-script');
                if (widgetScript) widgetScript.remove();
              }
            }
          }
        } catch (err) {
          // Ignore errors
        }
      }, 5000);
    }
    return () => {
      clearInterval(interval);
      setPolling(false);
    };
  }, [interviewStarted, candidate, lastStatus]);

  const fetchJobs = async () => {
    try {
      const res = await jobAPI.list();
      setJobs(res.data.jobs || []);
    } catch (e) {
      toast.error('Failed to fetch jobs');
    }
  };

  const onDrop = async (acceptedFiles) => {
    if (acceptedFiles.length === 0 || !selectedJob) return;
    const file = acceptedFiles[0];
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append('resume', file);
    formData.append('job_id', selectedJob._id);
    formData.append('job_skills', selectedJob.required_skills.map(s => s.skill).join(','));
    formData.append('job_description', selectedJob.description);
    try {
      const response = await resumeAPI.upload(formData);
      const uploadedCandidate = response.data.data;
      setCandidate(uploadedCandidate);
      // Immediately trigger ATS scoring
      const skillsArray = uploadedCandidate.ats_analysis?.skills_matched?.map(s => s.skill) || selectedJob?.required_skills?.map(s => s.skill) || [];
      const atsRes = await fetch('/api/calculate-ats-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: uploadedCandidate._id,
          resume_text: uploadedCandidate.resume_text,
          job_skills: skillsArray,
          job_description: selectedJob?.description || ''
        })
      });
      const atsResult = await atsRes.json();
      if (atsResult.status === 'success') {
        setAtsAnalysis(atsResult.data);
        setCandidate(prev => ({ ...prev, ats_score: atsResult.data.overall_score, ats_analysis: atsResult.data, status: 'ats_scored' }));
        toast.success('ATS analysis complete!');
      } else {
        toast.error('Failed to calculate ATS score');
      }
    } catch (error) {
      toast.error('Failed to upload resume');
      console.error('Upload error:', error);
    } finally {
      setLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false
  });

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setResumeFile(file);
      setError('');
    } else {
      setError('Please upload a valid PDF file');
    }
  };

  const parseResume = async () => {
    if (!resumeFile) {
      setError('Please select a resume file first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', resumeFile);

      const response = await fetch('http://localhost:5000/api/parse-resume', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.status === 'success') {
        setResumeData(result.data);
        setError('');
      } else {
        setError(result.error || 'Failed to parse resume');
      }
    } catch (err) {
      setError('Error parsing resume: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateATSScore = async () => {
    if (!resumeData || !jobSkills.trim()) {
      setError('Please parse a resume and enter job skills first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const skillsArray = jobSkills.split(',').map(skill => skill.trim()).filter(skill => skill);
      
      const response = await fetch('http://localhost:5000/api/calculate-ats-score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resume_text: resumeData.text,
          job_skills: skillsArray,
          job_description: jobDescription
        }),
      });

      const result = await response.json();

      if (result.status === 'success') {
        setAtsAnalysis(result.data);
        setError('');
        toast.success('ATS analysis complete!');
      } else {
        setError(result.error || 'Failed to calculate ATS score');
        toast.error('Failed to calculate ATS score');
      }
    } catch (err) {
      setError('Error calculating ATS score: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const analyzeTranscript = async () => {
    if (!transcript.trim()) {
      setError('Please enter interview transcript first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/analyze-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: transcript
        }),
      });

      const result = await response.json();

      if (result.status === 'success') {
        setInterviewAnalysis(result.data);
        setError('');
      } else {
        setError(result.error || 'Failed to analyze transcript');
      }
    } catch (err) {
      setError('Error analyzing transcript: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'resume_uploaded':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'interview_scheduled':
        return <Phone className="w-5 h-5 text-yellow-500" />;
      case 'interview_completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'evaluated':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'resume_uploaded':
        return 'Resume Uploaded';
      case 'interview_scheduled':
        return 'Interview Scheduled';
      case 'interview_completed':
        return 'Interview Completed';
      case 'evaluated':
        return 'Evaluation Complete';
      default:
        return 'Pending';
    }
  };

  const getRadarData = () => {
    if (!atsAnalysis?.skill_matches) return null;

    return {
      labels: atsAnalysis.skill_matches.map(match => match.skill),
      datasets: [{
        label: 'Skill Match Score',
        data: atsAnalysis.skill_matches.map(match => match.match_score),
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
      }]
    };
  };

  const getScoreBreakdownData = () => {
    if (!interviewAnalysis?.analysis?.score_breakdown) return null;

    const breakdown = interviewAnalysis.analysis.score_breakdown;
    
    return {
      labels: Object.keys(breakdown).map(key => 
        key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
      ),
      datasets: [{
        label: 'Score',
        data: Object.values(breakdown),
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)'
        ],
        borderWidth: 1,
      }]
    };
  };

  const getBehavioralBreakdownData = () => {
    if (!interviewAnalysis?.breakdown?.behavioral_indicators) return null;

    const indicators = interviewAnalysis.breakdown.behavioral_indicators;
    
    return {
      labels: Object.keys(indicators).map(key => 
        key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
      ),
      datasets: [{
        label: 'Behavioral Score',
        data: Object.values(indicators).map(indicator => indicator.score),
        backgroundColor: 'rgba(75, 192, 192, 0.8)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      }]
    };
  };

  const getConfidenceColor = (level) => {
    switch (level) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const radarOptions = {
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: {
          stepSize: 20
        }
      }
    },
    plugins: {
      legend: {
        display: false
      }
    }
  };

  const filteredJobs = jobs
    .filter(job =>
      job.title.toLowerCase().includes(jobSearch.toLowerCase()) ||
      (job.company && job.company.toLowerCase().includes(jobSearch.toLowerCase())) ||
      (job.required_skills && job.required_skills.some(s => s.skill.toLowerCase().includes(jobSearch.toLowerCase())))
    )
    .sort((a, b) => {
      if (jobSort === "title") return a.title.localeCompare(b.title);
      if (jobSort === "company") return (a.company || "").localeCompare(b.company || "");
      if (jobSort === "skills") return (b.required_skills?.length || 0) - (a.required_skills?.length || 0);
      return 0;
    });

  return (
    <div className="relative font-sans">
      <div className="absolute top-6 right-8 z-50 flex items-center gap-3">
        {user && (
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-green-400 to-blue-400 flex items-center justify-center text-white font-bold text-lg shadow-lg border-2 border-white/70">
            {user.firstName ? user.firstName[0] : user.emailAddress[0]}
          </div>
        )}
        <SignOutButton asChild>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow hover:bg-red-50 hover:text-red-600 transition-colors duration-200 group relative overflow-hidden"
            title="Sign out"
            style={{ boxShadow: '0 2px 12px 0 rgba(255,0,80,0.08)' }}
          >
            <span className="flex items-center gap-2">
              <span className="absolute inset-0 rounded-full pointer-events-none group-hover:shadow-[0_0_16px_4px_rgba(255,0,80,0.25)] transition-all duration-300" />
              <LogOut className="w-5 h-5 group-hover:rotate-[-20deg] group-hover:scale-110 transition-transform duration-300" />
              <span className="hidden sm:inline font-semibold">Sign Out</span>
            </span>
          </button>
        </SignOutButton>
      </div>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              AutoHireAI - Candidate Dashboard
            </h1>
            <p className="text-gray-600">
              Intelligent resume parsing and behavioral analysis powered by Google Gemini AI
            </p>
          </div>

          {/* Voice Widget Info Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 flex items-center">
            <svg className="w-8 h-8 text-blue-500 mr-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6a2 2 0 012-2h2a2 2 0 012 2v13m-6 0h6" /></svg>
            <div>
              <h2 className="text-lg font-semibold text-blue-900 mb-1">Voice Interview Widget</h2>
              <p className="text-blue-700 text-sm">
                To complete your behavioral interview, simply click the floating microphone button at the bottom right of this page. <br />
                Our AI agent, <strong>AutoHireAI</strong>, will conduct your interview directly in your browser—no phone call required!
              </p>
            </div>
          </div>

          {!candidate ? (
            /* Resume Upload Section */
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Find Your Next Opportunity</h2>
                <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-2 md:space-y-0 mb-6">
                  <input
                    type="text"
                    value={jobSearch}
                    onChange={e => setJobSearch(e.target.value)}
                    placeholder="Search jobs by title, company, or skill..."
                    className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={jobSort}
                    onChange={e => setJobSort(e.target.value)}
                    className="w-full md:w-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="title">Sort by Title</option>
                    <option value="company">Sort by Company</option>
                    <option value="skills">Sort by # Skills</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredJobs.length === 0 ? (
                    <div className="col-span-full text-center text-gray-500">No jobs found.</div>
                  ) : (
                    filteredJobs.map(job => (
                      <div key={job._id} className="bg-blue-50 rounded-xl shadow hover:shadow-lg transition-shadow p-6 flex flex-col justify-between">
                    <div>
                          <h3 className="text-lg font-semibold text-blue-900 mb-1">{job.title}</h3>
                          {job.company && <div className="text-sm text-blue-700 mb-2">{job.company}</div>}
                          <div className="flex flex-wrap gap-2 mb-3">
                            {job.required_skills?.map((s, i) => (
                              <span key={i} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">{s.skill}</span>
                            ))}
                          </div>
                        </div>
                        <button
                          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                          onClick={() => setJobModal(job)}
                        >
                          View & Apply
                        </button>
                    </div>
                    ))
                  )}
                </div>
                </div>

              {/* Job Modal for details and application */}
              {jobModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                  <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-8 relative animate-fadeIn">
                    <button
                      className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl"
                      onClick={() => setJobModal(null)}
                    >
                      &times;
                    </button>
                    <h2 className="text-2xl font-bold text-blue-900 mb-2">{jobModal.title}</h2>
                    {jobModal.company && <div className="text-blue-700 mb-2">{jobModal.company}</div>}
                    <div className="mb-4 text-gray-700 whitespace-pre-line">{jobModal.description}</div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {jobModal.required_skills?.map((s, i) => (
                        <span key={i} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">{s.skill}</span>
                      ))}
                    </div>
                    {/* Resume Upload Form */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Upload Your Resume (PDF)</label>
                      <div
                        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
                        onClick={() => document.getElementById('resume-upload-input').click()}
                        onDrop={async (e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files[0];
                          if (!file || file.type !== 'application/pdf') {
                            toast.error('Please upload a PDF file');
                            return;
                          }
                          setLoading(true);
                          const formData = new FormData();
                          formData.append('resume', file);
                          formData.append('job_id', jobModal._id);
                          formData.append('job_skills', jobModal.required_skills.map(s => s.skill).join(','));
                          formData.append('job_description', jobModal.description);
                          try {
                            const response = await resumeAPI.upload(formData);
                            const uploadedCandidate = response.data.data;
                            setCandidate(uploadedCandidate);
                            // Immediately trigger ATS scoring
                            const skillsArray = uploadedCandidate.ats_analysis?.skills_matched?.map(s => s.skill) || jobModal?.required_skills?.map(s => s.skill) || [];
                            const atsRes = await fetch('/api/calculate-ats-score', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                candidate_id: uploadedCandidate._id,
                                resume_text: uploadedCandidate.resume_text,
                                job_skills: skillsArray,
                                job_description: jobModal?.description || ''
                              })
                            });
                            const atsResult = await atsRes.json();
                            if (atsResult.status === 'success') {
                              setAtsAnalysis(atsResult.data);
                              setCandidate(prev => ({ ...prev, ats_score: atsResult.data.overall_score, ats_analysis: atsResult.data, status: 'ats_scored' }));
                              toast.success('ATS analysis complete!');
                            } else {
                              toast.error('Failed to calculate ATS score');
                            }
                            setJobModal(null);
                          } catch (error) {
                            toast.error('Failed to upload resume');
                            console.error('Upload error:', error);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        onDragOver={e => e.preventDefault()}
                      >
                        <input
                          id="resume-upload-input"
                          type="file"
                          accept="application/pdf"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file || file.type !== 'application/pdf') {
                              toast.error('Please upload a PDF file');
                              return;
                            }
                            setLoading(true);
                            const formData = new FormData();
                            formData.append('resume', file);
                            formData.append('job_id', jobModal._id);
                            formData.append('job_skills', jobModal.required_skills.map(s => s.skill).join(','));
                            formData.append('job_description', jobModal.description);
                            try {
                              const response = await resumeAPI.upload(formData);
                              const uploadedCandidate = response.data.data;
                              setCandidate(uploadedCandidate);
                              // Immediately trigger ATS scoring
                              const skillsArray = uploadedCandidate.ats_analysis?.skills_matched?.map(s => s.skill) || jobModal?.required_skills?.map(s => s.skill) || [];
                              const atsRes = await fetch('/api/calculate-ats-score', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  candidate_id: uploadedCandidate._id,
                                  resume_text: uploadedCandidate.resume_text,
                                  job_skills: skillsArray,
                                  job_description: jobModal?.description || ''
                                })
                              });
                              const atsResult = await atsRes.json();
                              if (atsResult.status === 'success') {
                                setAtsAnalysis(atsResult.data);
                                setCandidate(prev => ({ ...prev, ats_score: atsResult.data.overall_score, ats_analysis: atsResult.data, status: 'ats_scored' }));
                                toast.success('ATS analysis complete!');
                              } else {
                                toast.error('Failed to calculate ATS score');
                              }
                              setJobModal(null);
                            } catch (error) {
                              toast.error('Failed to upload resume');
                              console.error('Upload error:', error);
                            } finally {
                              setLoading(false);
                            }
                          }}
                        />
                        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-gray-600 mb-2">Drag and drop your resume here, or click to select</p>
                        <p className="text-sm text-gray-500">Only PDF files are accepted</p>
                      </div>
                    </div>
                {loading && (
                  <div className="mt-4 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-600 mt-2">Analyzing your resume...</p>
                  </div>
                )}
              </div>
                </div>
              )}
            </div>
          ) : (
            /* Candidate Profile Section */
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Your Profile</h2>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(candidate.status)}
                    <span className="text-sm font-medium text-gray-600">
                      {getStatusText(candidate.status)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{candidate.name}</h3>
                    <div className="space-y-2">
                      <div className="flex items-center text-gray-600">
                        <Mail className="w-4 h-4 mr-2" />
                        {candidate.email}
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Phone className="w-4 h-4 mr-2" />
                        {candidate.phone}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center mb-2">
                      <h4 className="font-medium text-gray-900 mr-2">ATS Score</h4>
                    </div>
                    <div className="flex items-center">
                      <div className="text-3xl font-bold text-blue-600 mr-2 drop-shadow-lg animate-pulse">
                        {candidate.ats_score}%
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-3 relative overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-400 via-blue-600 to-blue-800 h-3 rounded-full shadow-lg transition-all duration-700"
                          style={{ width: `${candidate.ats_score}%` }}
                        ></div>
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full shadow-md animate-fadeIn">
                          {candidate.ats_score >= 80 ? 'Excellent' : candidate.ats_score >= 65 ? 'Good' : 'Needs Improvement'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Skills Radar Chart */}
              {getRadarData() && (
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mr-2">Skill Match Analysis</h3>
                  </div>
                  <div className="h-64">
                    <Radar
                      data={getRadarData()}
                      options={{
                        ...radarOptions,
                        plugins: {
                          ...radarOptions.plugins,
                          legend: { display: true, position: 'top', labels: { color: '#2563eb', font: { size: 14, weight: 'bold' } } },
                          tooltip: { enabled: true, callbacks: { label: ctx => `${ctx.label}: ${ctx.raw}%` } }
                        },
                        animation: { duration: 1200, easing: 'easeOutBounce' }
                      }}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {atsAnalysis?.skill_matches?.map((match, i) => (
                      <span key={i} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        {match.skill}: {match.match_score}%
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Gemini Analysis Details */}
              {candidate.strengths && candidate.strengths.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Analysis</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Strengths */}
                    <div>
                      <h4 className="font-medium text-green-700 mb-2">Key Strengths</h4>
                      <ul className="space-y-1">
                        {candidate.strengths.map((strength, index) => (
                          <li key={index} className="text-sm text-gray-600 flex items-start">
                            <span className="text-green-500 mr-2">✓</span>
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Recommendations */}
                    <div>
                      <h4 className="font-medium text-blue-700 mb-2">Recommendations</h4>
                      <ul className="space-y-1">
                        {candidate.recommendations && candidate.recommendations.map((rec, index) => (
                          <li key={index} className="text-sm text-gray-600 flex items-start">
                            <span className="text-blue-500 mr-2">→</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Overall Assessment */}
                  {candidate.overall_assessment && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">Overall Assessment</h4>
                      <p className="text-sm text-gray-600">{candidate.overall_assessment}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Interview Status */}
              {candidate.status === 'interview_scheduled' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Clock className="w-5 h-5 text-yellow-600 mr-2" />
                    <div>
                      <h4 className="font-medium text-yellow-800">Interview Scheduled</h4>
                      <p className="text-sm text-yellow-700">
                        You will receive a call shortly for your AI-powered behavioral interview.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Results */}
              {candidate.behavior_score && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Interview Results</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{candidate.behavior_score}%</div>
                      <div className="text-sm text-gray-600">Behavior Score</div>
                    </div>
                    {candidate.final_score && (
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{candidate.final_score}%</div>
                        <div className="text-sm text-gray-600">Final Score</div>
                      </div>
                    )}
                    {candidate.recommendation && (
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-lg font-semibold text-purple-600 capitalize">
                          {candidate.recommendation}
                        </div>
                        <div className="text-sm text-gray-600">Recommendation</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Omnidimension Widget and Interview Controls */}
          {candidate && candidate.ats_score >= 65 && candidate.status !== 'interview_started' && candidate.status !== 'interview_completed' && !interviewStarted && (
            <div className="flex flex-col items-center mt-10">
              <button
                className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 shadow-xl animate-pulse focus:outline-none group hover:scale-110 transition-transform"
                onClick={() => setShowInterviewModal(true)}
                aria-label="Start Behavioral Interview"
              >
                <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-40 group-hover:opacity-60 animate-ping"></span>
                <Mic className="w-10 h-10 text-white z-10" />
              </button>
              <span className="mt-3 text-blue-700 font-semibold text-lg animate-fadeIn">Ready for your AI Voice Interview?</span>
            </div>
          )}

          {/* Interview Modal */}
          {showInterviewModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 relative animate-fadeIn">
                <button
                  className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl"
                  onClick={() => setShowInterviewModal(false)}
                >
                  &times;
                </button>
                <h2 className="text-2xl font-bold text-blue-900 mb-2">Start Behavioral Interview</h2>
                <p className="mb-4 text-gray-700">Our AI agent will conduct your interview directly in your browser. Please ensure you are in a quiet environment and your microphone is enabled.</p>
            <button
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition text-lg font-semibold"
                  onClick={async () => {
                    setShowInterviewModal(false);
                    setWidgetLoading(true);
                    try {
                      const res = await fetch('/api/start-interview', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: candidate.email })
                      });
                      const result = await res.json();
                      if (result.status === 'success') {
                        injectOmnidimensionWidget();
                        setInterviewStarted(true);
                        setTimeout(() => setWidgetLoading(false), 2000);
                      } else {
                        setWidgetLoading(false);
                        toast.error(result.error || 'Failed to start interview');
                      }
                    } catch (err) {
                      setWidgetLoading(false);
                      toast.error('Failed to start interview');
                    }
                  }}
                >
                  Start Interview
            </button>
              </div>
            </div>
          )}

          {/* Widget Loading Spinner */}
          {widgetLoading && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center animate-fadeIn">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mb-4"></div>
                <span className="text-blue-700 font-semibold">Loading interview widget...</span>
              </div>
            </div>
          )}

          {candidate && candidate.ats_score >= 65 && candidate.status === 'interview_started' && (
            <div className="mt-8 p-4 bg-yellow-100 text-yellow-800 rounded">
              Interview in progress. Please complete your interview.
            </div>
          )}
          {candidate && candidate.ats_score >= 65 && candidate.status === 'interview_completed' && (
            <div className="mt-8 p-4 bg-green-100 text-green-800 rounded">
              Your results are being evaluated. You cannot start another interview.
            </div>
          )}
          {candidate && candidate.ats_score >= 65 && interviewStarted && !widgetLoading && (
            <div id="omnidimension-web-widget" className="fixed bottom-6 right-6 z-50"></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CandidateDashboard; 