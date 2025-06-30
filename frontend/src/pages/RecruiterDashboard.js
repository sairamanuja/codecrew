import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { 
  Users, 
  Phone, 
  Mail, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  TrendingUp,
  UserPlus,
  FileText,
  Search,
  LogOut
} from 'lucide-react';
import { candidateAPI, interviewAPI, emailAPI, dashboardAPI, jobAPI } from '../services/api';
import { Radar } from 'react-chartjs-2';
import axios from 'axios';
import { SignOutButton, useUser } from "@clerk/clerk-react";

const RecruiterDashboard = () => {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailData, setEmailData] = useState({
    interview_date: '',
    interview_time: '',
    zoom_link: ''
  });
  const [jobs, setJobs] = useState([]);
  const [jobForm, setJobForm] = useState({ title: '', description: '', required_skills: [{ skill: '', weight: 1 }] });
  const [jobSearch, setJobSearch] = useState("");
  const [jobSort, setJobSort] = useState("title");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateSort, setCandidateSort] = useState("name");
  const [candidateModal, setCandidateModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingCandidate, setMeetingCandidate] = useState(null);
  const [meetingForm, setMeetingForm] = useState({ date: '', time: '', type: 'in-person', location: '' });
  const [meetingLoading, setMeetingLoading] = useState(false);
  const { user } = useUser();

  const classifiedCandidates = {
    needsReview: candidates.filter(c => c.status === 'resume_uploaded' || c.status === 'ats_scored'),
    interviewed: candidates.filter(c => c.status === 'interview_completed' || c.status === 'evaluated'),
    hired: candidates.filter(c => c.status === 'hired'),
    rejected: candidates.filter(c => c.status === 'rejected'),
  };

  useEffect(() => {
    fetchData();
    fetchJobs();
  }, []);

  useEffect(() => {
    setStats(prevStats => ({
      ...prevStats,
      total_candidates: candidates.length,
      interviewed_candidates: candidates.filter(c => c.status === 'interview_completed' || c.status === 'evaluated').length,
      hired_candidates: candidates.filter(c => c.status === 'hired').length,
      rejected_candidates: candidates.filter(c => c.status === 'rejected').length,
      conversion_rate: candidates.length > 0 ? (candidates.filter(c => c.status === 'hired').length / candidates.length) * 100 : 0
    }));
  }, [candidates]);

  const fetchData = async () => {
    try {
      const [candidatesRes, statsRes] = await Promise.all([
        candidateAPI.getAll(),
        dashboardAPI.getStats()
      ]);
      setCandidates(candidatesRes.data.candidates || []);
      setStats(statsRes.data.stats || {});
    } catch (error) {
      toast.error('Failed to fetch data');
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await jobAPI.list();
      setJobs(res.data.jobs || []);
    } catch (e) {
      toast.error('Failed to fetch jobs');
    }
  };

  const handleJobFormChange = (e, idx = null) => {
    if (e.target.name === 'required_skills') {
      const newSkills = [...jobForm.required_skills];
      newSkills[idx][e.target.dataset.field] = e.target.value;
      setJobForm({ ...jobForm, required_skills: newSkills });
    } else {
      setJobForm({ ...jobForm, [e.target.name]: e.target.value });
    }
  };

  const addSkillField = () => {
    setJobForm({ ...jobForm, required_skills: [...jobForm.required_skills, { skill: '', weight: 1 }] });
  };

  const createJob = async () => {
    try {
      await jobAPI.create(jobForm);
      toast.success('Job created!');
      setJobForm({ title: '', description: '', required_skills: [{ skill: '', weight: 1 }] });
      fetchJobs();
    } catch (e) {
      toast.error('Failed to create job');
    }
  };

  const scheduleEmail = async () => {
    if (!selectedCandidate) return;

    setLoading(true);
    try {
      await emailAPI.scheduleInterview({
        candidate_id: selectedCandidate._id,
        ...emailData
      });
      
      setCandidates(prev => prev.map(c => 
        c._id === selectedCandidate._id 
          ? { ...c, interview_scheduled: true, status: 'interview_scheduled' }
          : c
      ));
      
      setShowEmailModal(false);
      toast.success('Interview email scheduled successfully!');
    } catch (error) {
      toast.error('Failed to schedule email');
      console.error('Email error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'resume_uploaded': { color: 'bg-blue-100 text-blue-800', icon: FileText },
      'interview_scheduled': { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      'interview_completed': { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      'evaluated': { color: 'bg-purple-100 text-purple-800', icon: CheckCircle }
    };

    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', icon: Clock };
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </span>
    );
  };

  const getRecommendationBadge = (recommendation) => {
    const config = {
      'hire': { color: 'bg-green-100 text-green-800', text: 'Hire' },
      'maybe': { color: 'bg-yellow-100 text-yellow-800', text: 'Maybe' },
      'reject': { color: 'bg-red-100 text-red-800', text: 'Reject' }
    };

    const badgeConfig = config[recommendation] || { color: 'bg-gray-100 text-gray-800', text: 'Pending' };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full ${badgeConfig.color}`}>
        {badgeConfig.text}
      </span>
    );
  };

  const filteredJobs = jobs
    .filter(job =>
      job.title.toLowerCase().includes(jobSearch.toLowerCase()) ||
      (job.description && job.description.toLowerCase().includes(jobSearch.toLowerCase())) ||
      (job.required_skills && job.required_skills.some(s => s.skill.toLowerCase().includes(jobSearch.toLowerCase())))
    )
    .sort((a, b) => {
      if (jobSort === "title") return a.title.localeCompare(b.title);
      if (jobSort === "skills") return (b.required_skills?.length || 0) - (a.required_skills?.length || 0);
      return 0;
    });

  const filteredCandidates = candidates
    .filter(c =>
      (c.name && c.name.toLowerCase().includes(candidateSearch.toLowerCase())) ||
      (c.email && c.email.toLowerCase().includes(candidateSearch.toLowerCase()))
    )
    .sort((a, b) => {
      if (candidateSort === "name") return (a.name || "").localeCompare(b.name || "");
      if (candidateSort === "ats") return (b.ats_score || 0) - (a.ats_score || 0);
      if (candidateSort === "status") return (a.status || "").localeCompare(b.status || "");
      return 0;
    });

  const markAsHired = async (candidate) => {
    setActionLoading(true);
    try {
      // Simulate backend update (replace with real API call if available)
      setCandidates(prev => prev.map(c => c._id === candidate._id ? { ...c, status: 'hired', recommendation: 'hire' } : c));
      toast.success('Candidate marked as hired!');
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
      setCandidateModal(null);
    } catch (e) {
      toast.error('Failed to mark as hired');
    } finally {
      setActionLoading(false);
    }
  };

  const rejectCandidate = async (candidate) => {
    setActionLoading(true);
    try {
      setCandidates(prev => prev.map(c => c._id === candidate._id ? { ...c, status: 'rejected', recommendation: 'reject' } : c));
      toast('Candidate rejected.', { icon: '❌' });
      setCandidateModal(null);
    } catch (e) {
      toast.error('Failed to reject candidate');
    } finally {
      setActionLoading(false);
    }
  };

  const handleScheduleMeeting = async () => {
    setMeetingLoading(true);
    try {
      const payload = {
        candidateId: meetingCandidate._id,
        candidateName: meetingCandidate.name,
        candidateEmail: meetingCandidate.email,
        meetingType: meetingForm.type,
        date: meetingForm.date,
        time: meetingForm.time,
        location: meetingForm.type === 'in-person' ? meetingForm.location : undefined
      };
      await axios.post('/api/schedule-meeting', payload);
      toast.success('Meeting scheduled and n8n notified!');
      setShowMeetingModal(false);
      setMeetingCandidate(null);
      setMeetingForm({ date: '', time: '', type: 'in-person', location: '' });
    } catch (e) {
      toast.error('Failed to schedule meeting');
    } finally {
      setMeetingLoading(false);
    }
  };

  if (loading && candidates.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative font-sans">
      <div className="absolute top-6 right-8 z-50 flex items-center gap-3">
        {user && (
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 flex items-center justify-center text-white font-bold text-lg shadow-lg border-2 border-white/70">
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
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">Recruiter Dashboard</h1>
              </div>
              <button
                onClick={() => navigate('/')}
                className="text-gray-500 hover:text-gray-700"
              >
                ← Back to Login
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6 animate-fadeInUp">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg animate-pulse">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Candidates</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_candidates || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Interviewed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.interviewed_candidates || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Hired</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.hired_candidates || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.conversion_rate ? `${stats.conversion_rate.toFixed(1)}%` : '0%'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Job Posting Form */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Post a New Job</h2>
            <input type="text" name="title" value={jobForm.title} onChange={handleJobFormChange} placeholder="Job Title" className="mb-2 w-full border px-2 py-1 rounded" />
            <textarea name="description" value={jobForm.description} onChange={handleJobFormChange} placeholder="Job Description" className="mb-2 w-full border px-2 py-1 rounded" />
            <div>
              <h4 className="font-medium mb-2">Required Skills</h4>
              {jobForm.required_skills.map((s, idx) => (
                <div key={idx} className="flex mb-2">
                  <input type="text" data-field="skill" name="required_skills" value={s.skill} onChange={e => handleJobFormChange(e, idx)} placeholder="Skill" className="mr-2 border px-2 py-1 rounded" />
                  <input type="number" data-field="weight" name="required_skills" value={s.weight} min={1} max={5} onChange={e => handleJobFormChange(e, idx)} placeholder="Weight" className="w-20 border px-2 py-1 rounded" />
                </div>
              ))}
              <button onClick={addSkillField} className="text-blue-600">+ Add Skill</button>
            </div>
            <button onClick={createJob} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded">Create Job</button>
          </div>

          {/* Job Listings */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Job Listings</h2>
            <ul>
              {jobs.map(job => (
                <li key={job._id} className="mb-2">
                  <strong>{job.title}</strong> - {job.description}
                  <div>Skills: {job.required_skills.map(s => `${s.skill} (${s.weight})`).join(', ')}</div>
                </li>
              ))}
            </ul>
          </div>

          {/* Candidates Table */}
          <div className="space-y-10">
            {/* Needs Review */}
            <div>
              <h2 className="text-xl font-bold mb-4 text-blue-800">Needs Review</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {classifiedCandidates.needsReview.length === 0 ? (
                  <div className="col-span-full text-center text-gray-400">No candidates needing review.</div>
                ) : (
                  classifiedCandidates.needsReview.map(candidate => (
                    <div key={candidate._id} className="bg-white rounded-xl shadow p-6 flex flex-col animate-fadeInUp">
                      <div className="flex items-center mb-2">
                        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-600 mr-4">
                          {candidate.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-gray-900">{candidate.name}</div>
                          <div className="text-sm text-gray-500">{candidate.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center mb-2">
                        <span className="text-sm font-medium text-gray-900 mr-2">ATS:</span>
                        <span className="text-sm font-bold text-blue-600 mr-2">{candidate.ats_score || 0}%</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2 w-20">
                          <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${candidate.ats_score || 0}%` }}></div>
                        </div>
                      </div>
                      <div className="flex items-center mb-2">
                        {getStatusBadge(candidate.status)}
                        <span className="ml-2">{getRecommendationBadge(candidate.recommendation)}</span>
                      </div>
                      <div className="flex space-x-2 mt-2">
                        {/* Example action: Schedule Interview */}
                        {candidate.status === 'resume_uploaded' && (
                          <button className="px-3 py-1 rounded bg-yellow-100 text-yellow-800 font-medium border border-yellow-200">Schedule Interview</button>
                        )}
                        {/* Future: Add more actions */}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            {/* Interviewed */}
            <div>
              <h2 className="text-xl font-bold mb-4 text-purple-800">Interviewed</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {classifiedCandidates.interviewed.length === 0 ? (
                  <div className="col-span-full text-center text-gray-400">No interviewed candidates.</div>
                ) : (
                  classifiedCandidates.interviewed.map(candidate => (
                    <div key={candidate._id} className="bg-white rounded-xl shadow p-6 flex flex-col animate-fadeInUp">
                      <div className="flex items-center mb-2">
                        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-600 mr-4">
                          {candidate.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-gray-900">{candidate.name}</div>
                          <div className="text-sm text-gray-500">{candidate.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center mb-2">
                        <span className="text-sm font-medium text-gray-900 mr-2">ATS:</span>
                        <span className="text-sm font-bold text-blue-600 mr-2">{candidate.ats_score || 0}%</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2 w-20">
                          <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${candidate.ats_score || 0}%` }}></div>
                        </div>
                      </div>
                      <div className="flex items-center mb-2">
                        {getStatusBadge(candidate.status)}
                        <span className="ml-2">{getRecommendationBadge(candidate.recommendation)}</span>
                      </div>
                      <div className="flex space-x-2 mt-2">
                        <button
                          className="px-3 py-1 rounded bg-indigo-100 text-indigo-800 font-medium border border-indigo-200"
                          onClick={() => setCandidateModal(candidate)}
                        >
                          Recruiter's Call
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            {/* Hired */}
            <div>
              <h2 className="text-xl font-bold mb-4 text-green-800">Hired</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {classifiedCandidates.hired.length === 0 ? (
                  <div className="col-span-full text-center text-gray-400">No hired candidates.</div>
                ) : (
                  classifiedCandidates.hired.map(candidate => (
                    <div key={candidate._id} className="bg-green-50 rounded-xl shadow p-6 flex flex-col animate-fadeInUp">
                      <div className="flex items-center mb-2">
                        <div className="h-12 w-12 rounded-full bg-green-200 flex items-center justify-center text-xl font-bold text-green-700 mr-4">
                          {candidate.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-green-900">{candidate.name}</div>
                          <div className="text-sm text-green-700">{candidate.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center mb-2">
                        <span className="text-sm font-medium text-green-900 mr-2">ATS:</span>
                        <span className="text-sm font-bold text-green-700 mr-2">{candidate.ats_score || 0}%</span>
                        <div className="flex-1 bg-green-100 rounded-full h-2 w-20">
                          <div className="bg-green-600 h-2 rounded-full transition-all duration-300" style={{ width: `${candidate.ats_score || 0}%` }}></div>
                        </div>
                      </div>
                      <div className="flex items-center mb-2">
                        {getStatusBadge(candidate.status)}
                        <span className="ml-2">{getRecommendationBadge(candidate.recommendation)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            {/* Rejected */}
            <div>
              <h2 className="text-xl font-bold mb-4 text-red-800">Rejected</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {classifiedCandidates.rejected.length === 0 ? (
                  <div className="col-span-full text-center text-gray-400">No rejected candidates.</div>
                ) : (
                  classifiedCandidates.rejected.map(candidate => (
                    <div key={candidate._id} className="bg-red-50 rounded-xl shadow p-6 flex flex-col animate-fadeInUp">
                      <div className="flex items-center mb-2">
                        <div className="h-12 w-12 rounded-full bg-red-200 flex items-center justify-center text-xl font-bold text-red-700 mr-4">
                          {candidate.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-red-900">{candidate.name}</div>
                          <div className="text-sm text-red-700">{candidate.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center mb-2">
                        <span className="text-sm font-medium text-red-900 mr-2">ATS:</span>
                        <span className="text-sm font-bold text-red-700 mr-2">{candidate.ats_score || 0}%</span>
                        <div className="flex-1 bg-red-100 rounded-full h-2 w-20">
                          <div className="bg-red-600 h-2 rounded-full transition-all duration-300" style={{ width: `${candidate.ats_score || 0}%` }}></div>
                        </div>
                      </div>
                      <div className="flex items-center mb-2">
                        {getStatusBadge(candidate.status)}
                        <span className="ml-2">{getRecommendationBadge(candidate.recommendation)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Schedule Interview Email
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Interview Date
                  </label>
                  <input
                    type="date"
                    value={emailData.interview_date}
                    onChange={(e) => setEmailData(prev => ({ ...prev, interview_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Interview Time
                  </label>
                  <input
                    type="time"
                    value={emailData.interview_time}
                    onChange={(e) => setEmailData(prev => ({ ...prev, interview_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zoom Link
                  </label>
                  <input
                    type="url"
                    value={emailData.zoom_link}
                    onChange={(e) => setEmailData(prev => ({ ...prev, zoom_link: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://meet.zoom.us/..."
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={scheduleEmail}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Modal */}
      {candidateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-8 relative animate-fadeIn">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl"
              onClick={() => setCandidateModal(null)}
            >
              &times;
            </button>
            <div className="flex items-center mb-6">
              <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-600 mr-4">
                {candidateModal.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <div className="text-2xl font-semibold text-gray-900">{candidateModal.name}</div>
                <div className="text-sm text-gray-500">{candidateModal.email}</div>
              </div>
            </div>
            {/* Timeline/Stepper */}
            <div className="flex items-center justify-center mb-8">
              {(() => {
                let step = 0;
                if (candidateModal.status === 'resume_uploaded') step = 1;
                if (candidateModal.ats_score) step = 2;
                if (candidateModal.status === 'interview_started' || candidateModal.status === 'interview_scheduled') step = 3;
                if (candidateModal.status === 'interview_completed') step = 4;
                if (candidateModal.status === 'evaluated') step = 5;
                const steps = [
                  { label: 'Resume', color: 'blue' },
                  { label: 'ATS', color: 'blue' },
                  { label: 'Interview', color: 'yellow' },
                  { label: 'Results', color: 'green' },
                ];
                return (
                  <div className="flex w-full max-w-lg">
                    {steps.map((s, i) => (
                      <div key={s.label} className="flex-1 flex flex-col items-center relative">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300 ${i <= step ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-110' : 'bg-white border-gray-300 text-gray-400'}`}>{i + 1}</div>
                        <span className={`mt-2 text-xs font-medium transition-colors duration-300 ${i <= step ? 'text-blue-700' : 'text-gray-400'}`}>{s.label}</span>
                        {i < steps.length - 1 && (
                          <div className={`absolute top-4 left-1/2 w-full h-1 -z-10 ${i < step ? 'bg-blue-500' : 'bg-gray-200'}`} style={{ right: '-50%', left: '50%' }}></div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            {/* ATS/Skill Match */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">ATS & Skill Match</h3>
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <span className="text-2xl font-bold text-blue-600 mr-2">{candidateModal.ats_score || 0}%</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2 w-32">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${candidateModal.ats_score || 0}%` }}
                      ></div>
                    </div>
                  </div>
                  {/* Skill tags */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {candidateModal.skills?.map((s, i) => (
                      <span key={i} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">{s}</span>
                    ))}
                  </div>
                </div>
                {/* Radar chart if available */}
                {candidateModal.skill_matches && (
                  <div className="w-56 h-56">
                    <Radar
                      data={{
                        labels: candidateModal.skill_matches.map(m => m.skill),
                        datasets: [{
                          label: 'Skill Match',
                          data: candidateModal.skill_matches.map(m => m.match_score),
                          backgroundColor: 'rgba(59, 130, 246, 0.2)',
                          borderColor: 'rgba(59, 130, 246, 1)',
                          borderWidth: 2,
                        }]
                      }}
                      options={{
                        scales: { r: { beginAtZero: true, max: 100 } },
                        plugins: { legend: { display: false } },
                        animation: { duration: 1200, easing: 'easeOutBounce' }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            {/* Interview Results */}
            {candidateModal.behavior_score && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Interview Results</h3>
                <div className="flex flex-wrap gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 flex-1 text-center">
                    <div className="text-2xl font-bold text-blue-600">{candidateModal.behavior_score}%</div>
                    <div className="text-sm text-gray-600">Behavior Score</div>
                  </div>
                  {candidateModal.final_score && (
                    <div className="bg-green-50 rounded-lg p-4 flex-1 text-center">
                      <div className="text-2xl font-bold text-green-600">{candidateModal.final_score}%</div>
                      <div className="text-sm text-gray-600">Final Score</div>
                    </div>
                  )}
                  {candidateModal.recommendation && (
                    <div className="bg-purple-50 rounded-lg p-4 flex-1 text-center">
                      <div className="text-lg font-semibold text-purple-600 capitalize">{candidateModal.recommendation}</div>
                      <div className="text-sm text-gray-600">Recommendation</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Recruiter's Call Modal Actions */}
            <div className="flex flex-col space-y-4 mt-6">
              <button
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                onClick={() => { markAsHired(candidateModal); setCandidateModal(null); }}
                disabled={actionLoading}
              >
                Hire
              </button>
              <button
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                onClick={() => { rejectCandidate(candidateModal); setCandidateModal(null); }}
                disabled={actionLoading}
              >
                Reject
              </button>
              <button
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                onClick={() => { setShowMeetingModal(true); setMeetingCandidate(candidateModal); setCandidateModal(null); }}
                disabled={actionLoading}
              >
                Schedule Meeting
              </button>
              <button
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                onClick={() => setCandidateModal(null)}
                disabled={actionLoading}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meeting Modal */}
      {showMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 relative animate-fadeIn">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl"
              onClick={() => setShowMeetingModal(false)}
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4">Schedule Meeting for {meetingCandidate?.name}</h2>
            <form onSubmit={e => { e.preventDefault(); handleScheduleMeeting(); }}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Date</label>
                <input type="date" className="w-full border px-2 py-1 rounded" required value={meetingForm.date} onChange={e => setMeetingForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Time</label>
                <input type="time" className="w-full border px-2 py-1 rounded" required value={meetingForm.time} onChange={e => setMeetingForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Type</label>
                <select className="w-full border px-2 py-1 rounded" value={meetingForm.type} onChange={e => setMeetingForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="in-person">In-Person</option>
                  <option value="zoom">Zoom</option>
                </select>
              </div>
              {meetingForm.type === 'in-person' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Location</label>
                  <input type="text" className="w-full border px-2 py-1 rounded" required value={meetingForm.location} onChange={e => setMeetingForm(f => ({ ...f, location: e.target.value }))} />
                </div>
              )}
              <div className="flex justify-end space-x-3 mt-6">
                <button type="button" onClick={() => setShowMeetingModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={meetingLoading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">{meetingLoading ? 'Scheduling...' : 'Schedule'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecruiterDashboard; 