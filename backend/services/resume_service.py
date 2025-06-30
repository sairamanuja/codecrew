import fitz  # PyMuPDF
import re
import google.generativeai as genai
from typing import Dict, List, Optional
import os
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

def print_available_gemini_models():
    api_key = os.getenv('GOOGLE_GEMINI_API_KEY')
    genai.configure(api_key=api_key)
    print("Available Gemini models for your API key:")
    for model in genai.list_models():
        print(model)

class ResumeService:
    def __init__(self):
        """Initialize the Resume Service with Google Gemini API"""
        self.gemini_api_key = os.getenv('GOOGLE_GEMINI_API_KEY')
        
        if not self.gemini_api_key:
            raise ValueError("GOOGLE_GEMINI_API_KEY not found in environment variables")
        
        # Configure Gemini API
        genai.configure(api_key=self.gemini_api_key)
        print_available_gemini_models()  # Debug: print available models
        try:
            self.model = genai.GenerativeModel('models/gemini-1.5-pro-latest')
        except Exception as e:
            print(f"Error initializing Gemini model: {e}")
            print("Available models:", genai.list_models())
        
        # Email and phone regex patterns
        self.email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        self.phone_pattern = r'(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
        
        # Enhanced skill patterns with synonyms
        self.skill_synonyms = {
            'python': ['python', 'py', 'django', 'flask', 'fastapi'],
            'javascript': ['javascript', 'js', 'node', 'react', 'angular', 'vue'],
            'java': ['java', 'spring', 'hibernate', 'maven', 'gradle'],
            'aws': ['aws', 'amazon web services', 'ec2', 's3', 'lambda'],
            'docker': ['docker', 'containerization', 'kubernetes', 'k8s'],
            'git': ['git', 'github', 'gitlab', 'version control'],
            'sql': ['sql', 'mysql', 'postgresql', 'database'],
            'machine learning': ['ml', 'machine learning', 'ai', 'artificial intelligence', 'tensorflow', 'pytorch']
        }
    
    def parse_resume(self, file_path: str) -> Dict:
        """
        Parse resume PDF and extract structured information with enhanced security
        """
        try:
            # Security: Validate file size and type
            if not self._validate_pdf_file(file_path):
                raise ValueError("Invalid or potentially malicious PDF file")
            
            # Open and extract text from PDF
            doc = fitz.open(file_path)
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            
            # Clean and normalize text
            text = self._clean_text(text)
            
            # Extract structured information
            resume_data = {
                'text': text,
                'name': self._extract_name(text),
                'email': self._extract_email(text),
                'phone': self._extract_phone(text),
                'skills': self._extract_skills_enhanced(text),
                'experience': self._extract_experience_enhanced(text),
                'education': self._extract_education_enhanced(text),
                'parsed_at': datetime.now().isoformat()
            }
            
            return resume_data
            
        except Exception as e:
            print(f"Error parsing resume: {str(e)}")
            return {
                'text': '',
                'name': 'Unknown',
                'email': '',
                'phone': '',
                'skills': [],
                'experience': [],
                'education': [],
                'parsed_at': datetime.now().isoformat(),
                'error': str(e)
            }
    
    def _validate_pdf_file(self, file_path: str) -> bool:
        """Validate PDF file for security and integrity"""
        try:
            # Check file size (max 10MB)
            if os.path.getsize(file_path) > 10 * 1024 * 1024:
                return False
            
            # Check if it's a valid PDF
            with open(file_path, 'rb') as f:
                header = f.read(4)
                if header != b'%PDF':
                    return False
            
            # Try to open with PyMuPDF to validate
            doc = fitz.open(file_path)
            if doc.page_count == 0:
                return False
            doc.close()
            
            return True
        except Exception:
            return False
    
    def calculate_ats_score(self, resume_text: str, job_skills: List[str], 
                          job_description: str = "") -> Dict:
        """
        Calculate ATS score using Google Gemini API with enhanced error handling
        """
        if not job_skills:
            return {
                'overall_score': 0,
                'skill_matches': [],
                'missing_skills': job_skills,
                'recommendations': ['No job skills provided for comparison'],
                'method': 'No skills provided'
            }
        
        try:
            # Create comprehensive prompt for Gemini
            prompt = self._create_ats_prompt(resume_text, job_skills, job_description)
            
            # Get response from Gemini
            response = self.model.generate_content(prompt)
            
            # Parse Gemini's response with multiple fallback methods
            ats_analysis = self._parse_gemini_response_robust(response.text)
            
            return ats_analysis
            
        except Exception as e:
            print(f"Error in Gemini ATS scoring: {str(e)}")
            # Fallback to basic scoring
            return self._fallback_ats_scoring(resume_text, job_skills)
    
    def _parse_gemini_response_robust(self, response_text: str) -> Dict:
        """Robust parsing of Gemini response with multiple fallback methods"""
        
        # Method 1: Try direct JSON parsing
        try:
            parsed_data = json.loads(response_text.strip())
            return self._validate_and_clean_parsed_data(parsed_data)
        except json.JSONDecodeError:
            pass
        
        # Method 2: Extract JSON block using regex
        try:
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                parsed_data = json.loads(json_str)
                return self._validate_and_clean_parsed_data(parsed_data)
        except (json.JSONDecodeError, AttributeError):
            pass
        
        # Method 3: Try to fix common JSON issues
        try:
            fixed_json = self._fix_common_json_issues(response_text)
            parsed_data = json.loads(fixed_json)
            return self._validate_and_clean_parsed_data(parsed_data)
        except json.JSONDecodeError:
            pass
        
        # Method 4: Extract key information using regex patterns
        try:
            return self._extract_info_with_regex(response_text)
        except Exception:
            pass
        
        # Final fallback
        print(f"Failed to parse Gemini response: {response_text[:200]}...")
        return self._fallback_ats_scoring("", [])
    
    def _fix_common_json_issues(self, text: str) -> str:
        """Fix common JSON formatting issues"""
        # Remove markdown code blocks
        text = re.sub(r'```json\s*', '', text)
        text = re.sub(r'```\s*', '', text)
        
        # Fix trailing commas
        text = re.sub(r',\s*}', '}', text)
        text = re.sub(r',\s*]', ']', text)
        
        # Fix unquoted keys
        text = re.sub(r'(\w+):', r'"\1":', text)
        
        # Fix single quotes to double quotes
        text = text.replace("'", '"')
        
        return text.strip()
    
    def _extract_info_with_regex(self, text: str) -> Dict:
        """Extract key information using regex patterns when JSON parsing fails"""
        
        # Extract overall score
        score_match = re.search(r'"overall_score":\s*(\d+(?:\.\d+)?)', text)
        overall_score = float(score_match.group(1)) if score_match else 0
        
        # Extract skill matches
        skill_matches = []
        skill_pattern = r'"skill":\s*"([^"]+)".*?"match_score":\s*(\d+(?:\.\d+)?)'
        for match in re.finditer(skill_pattern, text, re.DOTALL):
            skill_matches.append({
                'skill': match.group(1),
                'match_score': float(match.group(2)),
                'evidence': 'Extracted from response',
                'match_level': 'good' if float(match.group(2)) > 70 else 'fair'
            })
        
        # Extract missing skills
        missing_pattern = r'"missing_skills":\s*\[(.*?)\]'
        missing_match = re.search(missing_pattern, text, re.DOTALL)
        missing_skills = []
        if missing_match:
            missing_text = missing_match.group(1)
            missing_skills = [s.strip().strip('"') for s in re.findall(r'"([^"]+)"', missing_text)]
        
        return {
            'overall_score': overall_score,
            'skill_matches': skill_matches,
            'missing_skills': missing_skills,
            'recommendations': ['Analysis completed with regex extraction'],
            'strengths': [],
            'experience_relevance': 70,
            'education_fit': 70,
            'overall_assessment': 'Analysis completed using fallback methods',
            'method': 'Regex extraction (JSON parsing failed)'
        }
    
    def _validate_and_clean_parsed_data(self, parsed_data: Dict) -> Dict:
        """Validate and clean parsed data from Gemini"""
        
        # Ensure all required fields are present with defaults
        return {
            'overall_score': float(parsed_data.get('overall_score', 0)),
            'skill_matches': parsed_data.get('skill_matches', []),
            'missing_skills': parsed_data.get('missing_skills', []),
            'recommendations': parsed_data.get('recommendations', []),
            'strengths': parsed_data.get('strengths', []),
            'experience_relevance': float(parsed_data.get('experience_relevance', 0)),
            'education_fit': float(parsed_data.get('education_fit', 0)),
            'overall_assessment': parsed_data.get('overall_assessment', ''),
            'method': 'Google Gemini AI'
        }
    
    def _extract_skills_enhanced(self, text: str) -> List[str]:
        """Enhanced skill extraction using synonyms and fuzzy matching"""
        skills = set()
        text_lower = text.lower()
        
        # Extract skills using synonym mapping
        for skill, synonyms in self.skill_synonyms.items():
            for synonym in synonyms:
                if synonym in text_lower:
                    skills.add(skill)
                    break
        
        # Look for skill sections
        skill_sections = re.findall(r'skills?[:\s]+([^.\n]+)', text, re.IGNORECASE)
        for section in skill_sections:
            section_skills = re.findall(r'\b\w+\b', section.lower())
            for skill in section_skills:
                if len(skill) > 2:
                    # Check if it matches any known skill
                    for main_skill, synonyms in self.skill_synonyms.items():
                        if skill in synonyms or skill == main_skill:
                            skills.add(main_skill)
                            break
        
        return list(skills)
    
    def _extract_experience_enhanced(self, text: str) -> List[Dict]:
        """Enhanced experience extraction with better pattern matching"""
        experience = []
        
        # Multiple patterns for different date formats
        exp_patterns = [
            r'(\d{4})\s*[-–]\s*(\d{4}|\bpresent\b|\bcurrent\b).*?([^.\n]+)',
            r'(\d{4})\s*[-–]\s*(\d{4}|\bpresent\b|\bcurrent\b).*?([^.\n]+)',
            r'(\w+\s+\d{4})\s*[-–]\s*(\w+\s+\d{4}|\bpresent\b|\bcurrent\b).*?([^.\n]+)',
            r'(\d{1,2}/\d{4})\s*[-–]\s*(\d{1,2}/\d{4}|\bpresent\b|\bcurrent\b).*?([^.\n]+)'
        ]
        
        for pattern in exp_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                experience.append({
                    'start_date': match.group(1),
                    'end_date': match.group(2),
                    'description': match.group(3).strip(),
                    'extracted_at': datetime.now().isoformat()
                })
        
        return experience
    
    def _extract_education_enhanced(self, text: str) -> List[Dict]:
        """Enhanced education extraction with better pattern matching"""
        education = []
        
        # Multiple patterns for education
        edu_patterns = [
            r'(bachelor|master|phd|b\.s\.|m\.s\.|ph\.d\.|bachelor\'s|master\'s).*?([^.\n]+)',
            r'(\d{4})\s*[-–]\s*(\d{4}|\bpresent\b).*?(university|college|school|institute)',
            r'(university|college|school|institute).*?(bachelor|master|phd|degree)',
            r'(b\.s\.|m\.s\.|ph\.d\.).*?([^.\n]+)'
        ]
        
        for pattern in edu_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                education.append({
                    'degree': match.group(1) if match.group(1) else 'Unknown',
                    'institution': match.group(2) if match.group(2) else 'Unknown',
                    'extracted_at': datetime.now().isoformat()
                })
        
        return education
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize resume text"""
        # Remove extra whitespace and normalize
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        # Remove special characters but keep important ones
        text = re.sub(r'[^\w\s@.-]', ' ', text)
        
        return text
    
    def _extract_name(self, text: str) -> str:
        """Extract candidate name from resume text"""
        # Simple name extraction - look for patterns like "Name: John Doe"
        name_patterns = [
            r'name[:\s]+([A-Za-z\s]+)',
            r'([A-Z][a-z]+\s+[A-Z][a-z]+)',  # First Last pattern
            r'([A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+)'  # First Middle Last
        ]
        
        for pattern in name_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        return "Unknown"
    
    def _extract_email(self, text: str) -> str:
        """Extract email address from resume text"""
        email_match = re.search(self.email_pattern, text)
        return email_match.group(0) if email_match else ""
    
    def _extract_phone(self, text: str) -> str:
        """Extract phone number from resume text"""
        phone_match = re.search(self.phone_pattern, text)
        return phone_match.group(0) if phone_match else ""
    
    def _create_ats_prompt(self, resume_text: str, job_skills: List[str], job_description: str) -> str:
        """Create a comprehensive prompt for Gemini ATS scoring, including skill weights if available"""
        # If job_skills is a list of dicts with 'skill' and 'weight', use weights
        if job_skills and isinstance(job_skills[0], dict) and 'weight' in job_skills[0]:
            skills_text = ", ".join([f"{s['skill']} (Importance: {s['weight']}/5)" for s in job_skills])
        else:
            skills_text = ", ".join(job_skills)

        prompt = f"""
You are an expert ATS (Applicant Tracking System) scoring assistant. Your task is to analyze a candidate's resume against job requirements and provide a comprehensive assessment.

JOB REQUIREMENTS:
Required Skills: {skills_text}
{f"Job Description: {job_description}" if job_description else ""}

CANDIDATE RESUME:
{resume_text}

Please analyze the resume and provide your assessment in the following JSON format:

{{
    "overall_score": <number between 0-100>,
    "skill_matches": [
        {{
            "skill": "<skill_name>",
            "match_score": <number between 0-100>,
            "evidence": "<brief explanation of how this skill is demonstrated>",
            "match_level": "<excellent/good/fair/poor>"
        }}
    ],
    "missing_skills": ["<list of missing skills>"],
    "recommendations": [
        "<specific recommendations for improvement>"
    ],
    "strengths": [
        "<list of candidate's key strengths>"
    ],
    "experience_relevance": <number between 0-100>,
    "education_fit": <number between 0-100>,
    "overall_assessment": "<brief overall assessment>"
}}

Guidelines for scoring:
- Overall score should reflect how well the candidate matches the job requirements, factoring in skill importance/weights
- Consider both explicit skill mentions and related experience
- Factor in experience relevance and education fit
- Be fair but thorough in your assessment
- Provide specific, actionable recommendations

Please respond with ONLY the JSON object, no additional text.
"""
        return prompt
    
    def _fallback_ats_scoring(self, resume_text: str, job_skills: List[str]) -> Dict:
        """Fallback scoring method if Gemini fails"""
        resume_lower = resume_text.lower()
        
        skill_matches = []
        missing_skills = []
        
        for skill in job_skills:
            skill_lower = skill.lower()
            if skill_lower in resume_lower:
                skill_matches.append({
                    'skill': skill,
                    'match_score': 100,
                    'evidence': f"Skill '{skill}' found in resume",
                    'match_level': 'excellent'
                })
            else:
                missing_skills.append(skill)
        
        overall_score = (len(skill_matches) / len(job_skills)) * 100 if job_skills else 0
        
        return {
            'overall_score': round(overall_score, 2),
            'skill_matches': skill_matches,
            'missing_skills': missing_skills,
            'recommendations': [
                f"Consider adding these skills: {', '.join(missing_skills[:3])}" if missing_skills else "Resume looks good!"
            ],
            'strengths': [],
            'experience_relevance': 70,
            'education_fit': 70,
            'overall_assessment': 'Basic keyword matching completed',
            'method': 'Fallback keyword matching'
        }
    
    def get_skill_radar_data(self, skill_matches: List[Dict]) -> Dict:
        """Generate data for radar chart visualization"""
        labels = [match['skill'] for match in skill_matches]
        scores = [match['match_score'] for match in skill_matches]
        
        return {
            'labels': labels,
            'datasets': [{
                'label': 'Skill Match Score',
                'data': scores,
                'backgroundColor': 'rgba(59, 130, 246, 0.2)',
                'borderColor': 'rgba(59, 130, 246, 1)',
                'borderWidth': 2,
                'pointBackgroundColor': 'rgba(59, 130, 246, 1)',
                'pointBorderColor': '#fff',
                'pointHoverBackgroundColor': '#fff',
                'pointHoverBorderColor': 'rgba(59, 130, 246, 1)'
            }]
        } 