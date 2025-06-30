from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_pymongo import PyMongo
from services.resume_service import ResumeService
from services.email_service import EmailService
from services.scoring_service import ScoringService
import os
from datetime import datetime
from dotenv import load_dotenv
import traceback
from bson import ObjectId
import requests

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key')
app.config['MONGO_URI'] = os.getenv('MONGODB_URI')
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = int(os.getenv('MAX_CONTENT_LENGTH', 16777216))

# Initialize extensions
CORS(app)
mongo = PyMongo(app)

# Initialize services
resume_service = ResumeService()
email_service = EmailService()
scoring_service = ScoringService()

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

ATS_THRESHOLD = 70
FINAL_SCORE_THRESHOLD = 0
N8N_WEBHOOK_URL = os.getenv('N8N_WEBHOOK_URL')

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'services': {
            'resume_service': 'available',
            'scoring_service': 'available',
            'email_service': 'available',
            'mongodb': 'available' if mongo.cx else 'unavailable'
        }
    })

@app.route('/api/parse-resume', methods=['POST'])
def parse_resume():
    try:
        file = request.files.get('file') or request.files.get('resume')
        if not file:
            return jsonify({'error': 'No file provided', 'status': 'error'}), 400
        if file.filename == '':
            return jsonify({'error': 'No file selected', 'status': 'error'}), 400
        filename = file.filename
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f"temp_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}")
        file.save(temp_path)
        resume_data = resume_service.parse_resume(temp_path)
        os.remove(temp_path)
        if 'error' in resume_data:
            return jsonify({'error': resume_data['error'], 'status': 'error'}), 400
        # Store candidate in DB
        job_id = request.form.get('job_id') or request.json.get('job_id')
        job = mongo.db.jobs.find_one({'_id': ObjectId(job_id)}) if job_id else None
        required_skills = []
        if job and 'required_skills' in job:
            required_skills = job['required_skills']
        # Flatten required_skills to just skill names for ATS scoring
        skill_names = [s['skill'] for s in required_skills]
        ats_analysis = resume_service.calculate_ats_score(resume_data.get('text', ''), skill_names)
        candidate = {
            'name': resume_data.get('name', 'Unknown'),
            'email': resume_data.get('email', ''),
            'phone': resume_data.get('phone', ''),
            'skills': resume_data.get('skills', []),
            'experience': resume_data.get('experience', []),
            'education': resume_data.get('education', []),
            'resume_text': resume_data.get('text', ''),
            'status': 'resume_uploaded',
            'created_at': datetime.now().isoformat(),
            'job_id': job_id,
            'ats_score': ats_analysis.get('overall_score', 0),
            'ats_analysis': ats_analysis
        }
        result = mongo.db.candidates.insert_one(candidate)
        candidate['_id'] = str(result.inserted_id)
        return jsonify({'data': candidate, 'status': 'success', 'message': 'Resume parsed and candidate stored'})
    except Exception as e:
        print(f"Error parsing resume: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': f'Internal server error: {str(e)}', 'status': 'error'}), 500

@app.route('/api/calculate-ats-score', methods=['POST'])
def calculate_ats_score():
    try:
        data = request.get_json()
        candidate_id = data.get('candidate_id')
        resume_text = data.get('resume_text', '')
        job_skills = data.get('job_skills', [])
        job_description = data.get('job_description', '')
        if not resume_text:
            return jsonify({'error': 'Resume text is required', 'status': 'error'}), 400
        if not job_skills:
            return jsonify({'error': 'Job skills are required', 'status': 'error'}), 400
        ats_analysis = resume_service.calculate_ats_score(resume_text, job_skills, job_description)
        # Update candidate in DB
        if candidate_id:
            mongo.db.candidates.update_one({'_id': candidate_id}, {'$set': {
                'ats_score': ats_analysis.get('overall_score', 0),
                'ats_analysis': ats_analysis,
                'status': 'ats_scored',
                'ats_scored_at': datetime.now().isoformat()
            }})
        return jsonify({'data': ats_analysis, 'status': 'success', 'message': 'ATS score calculated successfully'})
    except Exception as e:
        print(f"Error calculating ATS score: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': f'Internal server error: {str(e)}', 'status': 'error'}), 500

@app.route('/api/analyze-transcript', methods=['POST'])
def analyze_transcript():
    data = request.get_json()
    print('Received analyze-transcript payload:', data)  # Debug log
    # Extract answers from Omnidimension webhook
    leadership = data.get('leadership_response')
    communication = data.get('communication_response')
    problem_solving = data.get('problem_solving_response')
    teamwork = data.get('teamwork_response')
    adaptability = data.get('adaptability_response')
    summary = data.get('summary_report')
    full_conversation = data.get('full_conversation') or data.get('transcript')
    candidate_email = data.get('email') or data.get('user_email')
    candidate_name = data.get('name') or data.get('candidate_name')

    # Fetch candidate from DB (using email if available)
    candidate = None
    if candidate_email:
        candidate = mongo.db.candidates.find_one({'email': candidate_email})
    else:
        # Try to find by name if email is missing (not recommended, but fallback)
        if candidate_name:
            candidate = mongo.db.candidates.find_one({'name': candidate_name})
    if not candidate:
        return jsonify({'status': 'error', 'error': 'Candidate not found'}), 404

    # Ensure email and name are set from DB if missing
    if not candidate_email:
        candidate_email = candidate.get('email')
    if not candidate_name:
        candidate_name = candidate.get('name')

    # Check for required fields
    if not candidate_email or not candidate_name:
        print("[n8n webhook] Missing candidate_email or candidate_name, skipping webhook trigger.")
        return jsonify({'status': 'error', 'error': 'Missing candidate_email or candidate_name'}), 400

    # Block multiple interviews (only if already completed)
    if candidate.get('status') == 'interview_completed':
        return jsonify({'status': 'error', 'error': 'Interview already completed for this candidate.'}), 400

    # Build answers dict for ML model
    answers = {
        'leadership': leadership,
        'communication': communication,
        'problem_solving': problem_solving,
        'teamwork': teamwork,
        'adaptability': adaptability,
        'summary': summary,
        'full_conversation': full_conversation
    }

    # Run ML scoring (replace with your actual model function)
    score = scoring_service.analyze_transcript(full_conversation or summary or "")

    # Update candidate record in DB if email is provided
    mongo.db.candidates.update_one(
        {'email': candidate_email},
        {'$set': {
            'interview_transcript': full_conversation,
            'behavior_score': score.get('overall_score', 0),
            'interview_analysis': score,
            'status': 'interview_completed',
            'interview_completed_at': datetime.now().isoformat(),
            'behavioral_answers': answers
        }}
    )

    # Optionally trigger n8n if score is high and required fields are present
    if score.get('overall_score', 0) >= FINAL_SCORE_THRESHOLD and N8N_WEBHOOK_URL and candidate_email and candidate_name:
        payload = {
            'candidate_name': candidate_name,
            'candidate_email': candidate_email,
            'behavior_score': score.get('overall_score', 0),
            'interview_summary': summary,
            'full_conversation': full_conversation,
            'answers': answers,
            'interview_date': data.get('interview_date'),
            'interview_time': data.get('interview_time')
        }
        print(f"Triggering n8n webhook: {N8N_WEBHOOK_URL}\nPayload: {payload}")
        try:
            requests.post(N8N_WEBHOOK_URL, json=payload, timeout=10)
        except Exception as e:
            print(f"Failed to trigger n8n: {e}")

    return jsonify({'status': 'success', 'score': score})

@app.route('/api/candidates', methods=['GET'])
def get_candidates():
    try:
        candidates = list(mongo.db.candidates.find())
        for candidate in candidates:
            candidate['_id'] = str(candidate['_id'])
        return jsonify({'success': True, 'candidates': candidates})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/stats', methods=['GET'])
def dashboard_stats():
    try:
        total_candidates = mongo.db.candidates.count_documents({})
        interviewed_candidates = mongo.db.candidates.count_documents({'status': 'interview_completed'})
        hired_candidates = mongo.db.candidates.count_documents({'recommendation': 'hire'})
        conversion_rate = (hired_candidates / total_candidates * 100) if total_candidates else 0

        stats = {
            'total_candidates': total_candidates,
            'interviewed_candidates': interviewed_candidates,
            'hired_candidates': hired_candidates,
            'conversion_rate': conversion_rate
        }
        return jsonify({'stats': stats, 'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/jobs', methods=['POST'])
def create_job():
    data = request.json
    job = {
        'title': data['title'],
        'description': data['description'],
        'required_skills': data['required_skills'],
        'created_at': datetime.now().isoformat()
    }
    result = mongo.db.jobs.insert_one(job)
    job['_id'] = str(result.inserted_id)
    return jsonify({'job': job, 'status': 'success'})

@app.route('/api/jobs', methods=['GET'])
def list_jobs():
    jobs = list(mongo.db.jobs.find())
    for job in jobs:
        job['_id'] = str(job['_id'])
    return jsonify({'jobs': jobs, 'status': 'success'})

@app.route('/api/jobs/<job_id>', methods=['GET'])
def get_job(job_id):
    job = mongo.db.jobs.find_one({'_id': ObjectId(job_id)})
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    job['_id'] = str(job['_id'])
    return jsonify({'job': job, 'status': 'success'})

@app.route('/api/resume/upload', methods=['POST'])
def resume_upload():
    return parse_resume()

@app.route('/api/start-interview', methods=['POST'])
def start_interview():
    data = request.get_json()
    candidate_email = data.get('email')
    if not candidate_email:
        return jsonify({'status': 'error', 'error': 'Missing candidate email'}), 400

    candidate = mongo.db.candidates.find_one({'email': candidate_email})
    if not candidate:
        return jsonify({'status': 'error', 'error': 'Candidate not found'}), 404

    if candidate.get('status') == 'interview_completed':
        return jsonify({'status': 'error', 'error': 'Interview already completed for this candidate.'}), 400

    mongo.db.candidates.update_one(
        {'email': candidate_email},
        {'$set': {'status': 'interview_started', 'interview_started_at': datetime.now().isoformat()}}
    )
    return jsonify({'status': 'success'})

@app.route('/api/schedule-meeting', methods=['POST'])
def schedule_meeting():
    data = request.json
    n8n_url = os.environ.get("N8N_MEETING_WEBHOOK_URL")
    print(f"[DEBUG] Forwarding meeting data to n8n: {n8n_url}")
    print(f"[DEBUG] Payload: {data}")
    if not n8n_url:
        return jsonify({"status": "error", "detail": "N8N_MEETING_WEBHOOK_URL not set in environment"}), 500
    try:
        n8n_response = requests.post(n8n_url, json=data)
        if n8n_response.status_code == 200:
            return jsonify({"status": "success"})
        else:
            print(f"[DEBUG] n8n response: {n8n_response.status_code} {n8n_response.text}")
            return jsonify({"status": "error", "detail": n8n_response.text}), 500
    except Exception as e:
        print(f"[DEBUG] Exception: {e}")
        return jsonify({"status": "error", "detail": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True) 